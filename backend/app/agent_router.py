import asyncio
import json
import os
import re
from typing import Any, Literal, TypedDict

try:
    from google import genai
    from google.genai import types
except ImportError:  # pragma: no cover - fallback routing still works without SDK
    genai = None
    types = None

SelectedTool = Literal["VQA", "CHANGE_DETECTION", "3D_MAP", "THERMAL_MAP"]
VisionMode = Literal["analysis", "grounding"]

ALLOWED_TOOLS: tuple[SelectedTool, ...] = (
    "VQA",
    "CHANGE_DETECTION",
    "3D_MAP",
    "THERMAL_MAP",
)

ROUTER_MODEL = "gemini-3.7-flash"
_router_client: Any | None = None


class RouteResult(TypedDict):
    selected_tool: SelectedTool
    confidence_score: float


class VisionIntentResult(TypedDict):
    mode: VisionMode
    confidence_score: float


def _fallback_route(user_query: str) -> RouteResult:
    query = user_query.lower()

    if any(word in query for word in ("change", "changed", "difference", "before", "after", "time", "compare")):
        return {"selected_tool": "CHANGE_DETECTION", "confidence_score": 0.78}

    if any(word in query for word in ("3d", "terrain", "elevation", "topography", "contour", "height")):
        return {"selected_tool": "3D_MAP", "confidence_score": 0.76}

    if any(word in query for word in ("thermal", "temperature", "heat", "hot", "cold", "lst")):
        return {"selected_tool": "THERMAL_MAP", "confidence_score": 0.77}

    return {"selected_tool": "VQA", "confidence_score": 0.72}


def _fallback_vision_intent(user_query: str) -> VisionIntentResult:
    query = user_query.casefold()

    analysis_phrases = (
        "describe",
        "what do you see",
        "what is in this image",
        "what type of area",
        "urban or rural",
        "explain",
        "observe",
        "caption",
        "summary",
        "summarize",
        "what changes",
        "visible",
        "बताओ",
        "वर्णन",
        "समझाओ",
    )
    grounding_phrases = (
        "where",
        "kaha",
        "कहा",
        "कहाँ",
        "highlight",
        "locate",
        "show me",
        "show the",
        "mark",
        "point out",
        "identify the position",
        "find",
        "box",
        "draw",
        "ground",
        "boundary",
        "water body",
        "building kaha",
        "road kaha",
    )

    if any(phrase in query for phrase in grounding_phrases):
        return {"mode": "grounding", "confidence_score": 0.76}

    if any(phrase in query for phrase in analysis_phrases):
        return {"mode": "analysis", "confidence_score": 0.82}

    return {"mode": "analysis", "confidence_score": 0.68}


def _extract_json(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
        if not match:
            raise
        return json.loads(match.group(0))


def _get_router_client() -> Any | None:
    global _router_client

    if genai is None:
        return None

    if os.getenv("SATQUERY_ENABLE_LLM_ROUTER") != "1":
        return None

    api_key = os.getenv("SATQUERY_ROUTER_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None

    if _router_client is None:
        _router_client = genai.Client(api_key=api_key)

    return _router_client


def _normalize_route(payload: dict[str, Any], fallback: RouteResult) -> RouteResult:
    selected_tool = payload.get("selected_tool")
    confidence_score = payload.get("confidence_score")

    if selected_tool not in ALLOWED_TOOLS:
        selected_tool = fallback["selected_tool"]

    try:
        confidence = float(confidence_score)
    except (TypeError, ValueError):
        confidence = fallback["confidence_score"]

    confidence = max(0.0, min(1.0, confidence))
    return {"selected_tool": selected_tool, "confidence_score": round(confidence, 2)}


def _normalize_vision_intent(payload: dict[str, Any], fallback: VisionIntentResult) -> VisionIntentResult:
    mode = payload.get("mode")
    confidence_score = payload.get("confidence_score")

    if mode not in {"analysis", "grounding"}:
        mode = fallback["mode"]

    try:
        confidence = float(confidence_score)
    except (TypeError, ValueError):
        confidence = fallback["confidence_score"]

    confidence = max(0.0, min(1.0, confidence))
    return {"mode": mode, "confidence_score": round(confidence, 2)}


async def route_query(user_query: str) -> RouteResult:
    fallback = _fallback_route(user_query)
    client = _get_router_client()
    if client is None or types is None:
        return fallback

    prompt = f"""
Classify this remote-sensing user query into exactly one tool.

Allowed selected_tool values:
- VQA: general question answering or scene description for imagery
- CHANGE_DETECTION: compare dates, before/after, changed areas, growth, flood/deforestation/new buildings
- 3D_MAP: terrain, elevation, 3D map, topography, contours
- THERMAL_MAP: temperature, heat, land surface temperature, hot/cold regions

Return only valid JSON with exactly these keys:
{{"selected_tool":"VQA","confidence_score":0.0}}

User query: {user_query}
""".strip()

    try:
        response = await asyncio.to_thread(
            client.models.generate_content,
            model=ROUTER_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0,
                response_mime_type="application/json",
            ),
        )
        payload = _extract_json(response.text)
        return _normalize_route(payload, fallback)
    except Exception:
        return fallback


async def route_vision_intent(user_query: str) -> VisionIntentResult:
    fallback = _fallback_vision_intent(user_query)
    client = _get_router_client()
    if client is None or types is None:
        return fallback

    prompt = f"""
Classify the user's remote-sensing image query into exactly one vision mode.

Modes:
- analysis: describe, explain, classify, summarize, answer normal image questions, or discuss visible changes without needing coordinates.
- grounding: locate, highlight, mark, point to, find, show, or identify the position of a specific object/region. Handle multilingual intent such as Hindi "kaha hai".

Return only JSON:
{{"mode":"analysis","confidence_score":0.0}}

User query: {user_query}
""".strip()

    try:
        response = await asyncio.to_thread(
            client.models.generate_content,
            model=ROUTER_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0,
                response_mime_type="application/json",
            ),
        )
        payload = _extract_json(response.text)
        return _normalize_vision_intent(payload, fallback)
    except Exception:
        return fallback
