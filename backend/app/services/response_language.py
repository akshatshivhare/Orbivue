ResponseLanguage = str


def normalize_response_language(value: str | None) -> ResponseLanguage:
    return "hi" if value == "hi" else "en"


def language_instruction(value: str | None) -> str:
    language = normalize_response_language(value)
    if language == "hi":
        return (
            "Respond in simple, natural Hindi. Keep technical remote-sensing terms in English where clearer. "
            "Do not use overly formal Hindi."
        )

    return "Respond in clear English."


def localized_grounding_fallback(value: str | None, *, found: bool, count: int = 0, label: str = "requested object") -> str:
    language = normalize_response_language(value)
    if language == "hi":
        if not found:
            return "मैं माँगी गई वस्तु को भरोसे से locate नहीं कर सका।"
        if count > 1:
            return f"Image में {count} matching regions highlight किए गए हैं।"
        return f"Image में {label} highlight किया गया है।"

    if not found:
        return "I could not confidently locate the requested object."
    if count > 1:
        return f"Highlighted {count} matching regions in the image."
    return f"The {label} is highlighted in the image."
