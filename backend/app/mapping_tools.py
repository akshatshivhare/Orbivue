from typing import Any


async def generate_3d_terrain(image_path: str) -> dict[str, Any]:
    return {
        "status": "completed",
        "message": "3D terrain placeholder generated successfully.",
        "input_image": image_path,
        "data": {
            "type": "terrain_preview",
            "preview_url": "/static/demo/terrain-preview.png",
            "elevation_units": "meters",
            "mesh_status": "placeholder"
        }
    }


async def generate_thermal_map(image_path: str) -> dict[str, Any]:
    return {
        "status": "completed",
        "message": "Thermal map placeholder generated successfully.",
        "input_image": image_path,
        "data": {
            "type": "thermal_overlay",
            "preview_url": "/static/demo/thermal-preview.png",
            "temperature_units": "celsius",
            "legend": {
                "low": "blue",
                "medium": "yellow",
                "high": "red"
            }
        }
    }
