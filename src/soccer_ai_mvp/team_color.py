from __future__ import annotations

import cv2
import numpy as np


def estimate_team_hint(frame: np.ndarray, bbox_xyxy: tuple[float, float, float, float]) -> str:
    x1, y1, x2, y2 = [int(v) for v in bbox_xyxy]
    h, w = frame.shape[:2]
    x1, x2 = max(0, x1), min(w - 1, x2)
    y1, y2 = max(0, y1), min(h - 1, y2)
    if x2 <= x1 or y2 <= y1:
        return "unknown"

    box_h = y2 - y1
    torso_y1 = y1 + int(box_h * 0.18)
    torso_y2 = y1 + int(box_h * 0.62)
    crop = frame[torso_y1:torso_y2, x1:x2]
    if crop.size == 0:
        return "unknown"

    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    sat = hsv[:, :, 1]
    val = hsv[:, :, 2]
    mask = (sat > 35) & (val > 45)
    if int(np.count_nonzero(mask)) < 20:
        mean_val = float(np.mean(val))
        return "team_dark" if mean_val < 95 else "team_light"

    hue_values = hsv[:, :, 0][mask]
    sat_values = sat[mask]
    val_values = val[mask]
    mean_hue = float(np.average(hue_values, weights=np.maximum(sat_values, 1)))
    mean_val = float(np.mean(val_values))

    if mean_val < 80:
        return "team_dark"
    if mean_hue < 12 or mean_hue > 165:
        return "team_red"
    if 12 <= mean_hue < 35:
        return "team_yellow"
    if 35 <= mean_hue < 85:
        return "team_green"
    if 85 <= mean_hue <= 135:
        return "team_blue"
    if 135 < mean_hue <= 165:
        return "team_purple"
    return "team_light"
