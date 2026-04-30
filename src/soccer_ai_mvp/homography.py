from __future__ import annotations

from typing import Optional

import numpy as np


class PitchMapper:
    def __init__(self, frame_width: int, frame_height: int, pitch_length: float, pitch_width: float, matrix: Optional[list[list[float]]] = None):
        self.frame_width = frame_width
        self.frame_height = frame_height
        self.pitch_length = pitch_length
        self.pitch_width = pitch_width
        self.matrix = np.array(matrix, dtype=np.float32) if matrix is not None else None

    def image_to_pitch(self, x: float, y: float) -> tuple[float, float]:
        if self.matrix is None:
            return (x / self.frame_width) * self.pitch_length, (y / self.frame_height) * self.pitch_width

        point = np.array([x, y, 1.0], dtype=np.float32)
        mapped = self.matrix @ point
        if abs(float(mapped[2])) < 1e-6:
            return (x / self.frame_width) * self.pitch_length, (y / self.frame_height) * self.pitch_width
        return float(mapped[0] / mapped[2]), float(mapped[1] / mapped[2])
