"""
자외선 파장에 따른 콜라겐 변성 가능성 분석 프로그램

이 프로그램은 고등학교 생명과학 탐구 발표용으로 만든 교육용 계산/시각화
모델입니다. 입력한 자외선 파장의 광자 1몰당 에너지를 계산하고, COL1A1
일부 서열에서 콜라겐 구조와 관련된 아미노산 위치 및 pLDDT가 낮은 구간을
함께 표시합니다.

중요:
- 이 프로그램은 실제 단백질 변성을 정확히 예측하지 않습니다.
- AlphaFold의 pLDDT는 정적인 구조 예측의 신뢰도 지표입니다.
- 실제 UV에 의한 단백질 변성 과정은 시간, 용매, 온도, 산소, 주변 분자,
  실험 조건 등에 영향을 받으므로 이 코드만으로 직접 시뮬레이션할 수 없습니다.
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path

# matplotlib가 기본 캐시를 홈 디렉터리에 만들려고 하면 권한 문제가 날 수 있습니다.
# 그래서 실행 환경에서 쓰기 가능한 임시 폴더를 캐시 위치로 지정합니다.
os.environ.setdefault("MPLCONFIGDIR", "/private/tmp/collagen_uv_matplotlib_cache")

import matplotlib

# 서버나 터미널 환경에서도 PNG 저장이 안정적으로 되도록 화면 출력이 필요 없는
# 백엔드를 사용합니다.
matplotlib.use("Agg")
from matplotlib import font_manager
import matplotlib.pyplot as plt


def configure_korean_font() -> str | None:
    """그래프에 한글이 깨지지 않도록 사용 가능한 한글 글꼴을 설정합니다.

    macOS에는 보통 Apple SD Gothic Neo 또는 AppleGothic 글꼴이 들어 있습니다.
    다른 운영체제에서 실행하는 경우에는 설치된 글꼴이 없을 수 있으므로, 찾지 못하면
    matplotlib 기본 글꼴을 그대로 사용합니다.
    """
    korean_font_paths = [
        Path("/System/Library/Fonts/AppleSDGothicNeo.ttc"),
        Path("/System/Library/Fonts/Supplemental/AppleGothic.ttf"),
        Path("/System/Library/Fonts/Supplemental/NotoSansGothic-Regular.ttf"),
        Path("/Library/Fonts/NanumGothic.ttf"),
    ]

    for font_path in korean_font_paths:
        if not font_path.exists():
            continue

        try:
            font_manager.fontManager.addfont(str(font_path))
            font_name = font_manager.FontProperties(fname=str(font_path)).get_name()
        except RuntimeError:
            continue

        plt.rcParams["font.family"] = font_name
        plt.rcParams["axes.unicode_minus"] = False
        return font_name

    plt.rcParams["axes.unicode_minus"] = False
    return None


KOREAN_FONT_NAME = configure_korean_font()


# -----------------------------
# 1. 기본 상수와 예시 데이터
# -----------------------------

# 문제에서 제시한 물리 상수입니다.
PLANCK_CONSTANT = 6.626e-34  # h, 단위: J*s
LIGHT_SPEED = 3.00e8  # c, 단위: m/s
AVOGADRO_NUMBER = 6.022e23  # N_A, 단위: mol^-1

# 실행 시 사용자가 입력을 생략하면 바로 실행될 예시 데이터입니다.
DEFAULT_WAVELENGTH_NM = 300.0
DEFAULT_SEQUENCE = "GEAGPQGPRGSEGPQGVRGEPGPPGPASAAGPA"

# pLDDT가 이 값보다 낮으면 구조 예측 신뢰도가 상대적으로 낮은 구간으로 표시합니다.
LOW_PLDDT_THRESHOLD = 70.0


# -----------------------------
# 2. 계산 함수
# -----------------------------

def calculate_uv_energy(wavelength_nm: float) -> float:
    """자외선 파장 nm를 광자 1몰당 에너지 kJ/mol로 변환합니다.

    계산 과정:
    1. nm 단위 파장을 m 단위로 변환합니다.
    2. 광자 1개의 에너지 E = hc/lambda 를 J 단위로 계산합니다.
    3. 광자 1몰의 에너지를 구하기 위해 아보가드로 수를 곱합니다.
    4. J/mol을 kJ/mol로 바꾸기 위해 1000으로 나눕니다.
    """
    if wavelength_nm <= 0:
        raise ValueError("파장은 0보다 커야 합니다.")

    wavelength_m = wavelength_nm * 1e-9
    energy_j_per_photon = PLANCK_CONSTANT * LIGHT_SPEED / wavelength_m
    energy_j_per_mol = energy_j_per_photon * AVOGADRO_NUMBER
    energy_kj_per_mol = energy_j_per_mol / 1000
    return energy_kj_per_mol


def classify_uv(wavelength_nm: float) -> str:
    """파장에 따라 UV-A, UV-B, UV-C 영역을 구분합니다.

    경계값이 겹치지 않도록 이 프로그램에서는 315 nm를 UV-A에 포함하고,
    280 nm 이상 315 nm 미만을 UV-B로 처리합니다.
    """
    if 315 <= wavelength_nm <= 400:
        return "UV-A"
    if 280 <= wavelength_nm < 315:
        return "UV-B"
    if 100 <= wavelength_nm < 280:
        return "UV-C"
    return "자외선 범위 밖"


def evaluate_damage_potential(energy_kj_mol: float) -> str:
    """에너지 크기에 따른 결합 손상 가능성을 정성적으로 평가합니다.

    이 평가는 실제 변성 예측이 아니라, 발표용 탐구 모델에서 사용하는 단순화된
    기준입니다.
    """
    if energy_kj_mol >= 400:
        return "결합 손상 가능성이 큰 고에너지 영역"
    if energy_kj_mol >= 300:
        return "단백질 손상에 관여할 수 있는 영역"
    return "상대적으로 낮은 에너지 영역"


def analyze_sequence(sequence: str) -> dict[str, list[int]]:
    """서열에서 Gly(G), Pro(P), Ala(A)의 위치를 1번부터 세어 찾습니다."""
    cleaned_sequence = clean_sequence(sequence)
    target_residues = {
        "G": [],
        "P": [],
        "A": [],
    }

    for index, residue in enumerate(cleaned_sequence, start=1):
        if residue in target_residues:
            target_residues[residue].append(index)

    return target_residues


# -----------------------------
# 3. 입력 보조 함수
# -----------------------------

def clean_sequence(sequence: str) -> str:
    """사용자가 공백을 넣어 입력해도 분석할 수 있도록 서열을 정리합니다."""
    cleaned = re.sub(r"\s+", "", sequence).upper()
    if not cleaned:
        raise ValueError("아미노산 서열이 비어 있습니다.")
    return cleaned


def prompt_with_default(prompt: str, default: str) -> str:
    """터미널 입력을 받되, Enter만 누르면 기본값을 사용합니다.

    자동 실행 환경에서는 input()이 멈추지 않도록 기본값을 바로 반환합니다.
    """
    if not sys.stdin.isatty():
        return default

    user_input = input(f"{prompt} [기본값: {default}]: ").strip()
    return user_input or default


def parse_plddt_scores(raw_text: str) -> list[float] | None:
    """쉼표나 공백으로 구분된 pLDDT 점수 목록을 읽습니다.

    예:
    90, 85, 72, 61
    90 85 72 61
    """
    text = raw_text.strip()
    if not text:
        return None

    tokens = [token for token in re.split(r"[,\s]+", text) if token]
    scores: list[float] = []

    for token in tokens:
        score = float(token)
        if not 0 <= score <= 100:
            raise ValueError("pLDDT 점수는 0 이상 100 이하이어야 합니다.")
        scores.append(score)

    return scores


def parse_custom_ranges(raw_text: str) -> list[tuple[int, int]]:
    """사용자 지정 취약 구간을 읽습니다.

    입력 형식 예:
    5-9, 22-26

    아무것도 입력하지 않으면 빈 목록을 반환합니다.
    """
    text = raw_text.strip()
    if not text:
        return []

    ranges: list[tuple[int, int]] = []
    parts = [part.strip() for part in text.split(",") if part.strip()]

    for part in parts:
        match = re.fullmatch(r"(\d+)\s*-\s*(\d+)", part)
        if not match:
            raise ValueError("취약 구간은 '시작-끝' 형식으로 입력해야 합니다. 예: 5-9")

        start = int(match.group(1))
        end = int(match.group(2))
        if start > end:
            start, end = end, start
        ranges.append((start, end))

    return ranges


def generate_example_plddt_scores(sequence: str) -> list[float]:
    """예시 pLDDT 데이터를 만듭니다.

    실제 AlphaFold 결과 파일을 읽는 대신, 발표용 예시 실행이 가능하도록 일부 구간의
    pLDDT를 낮게 설정했습니다.
    """
    scores: list[float] = []

    for position, residue in enumerate(sequence, start=1):
        # 기본적으로는 비교적 높은 신뢰도 점수를 부여합니다.
        score = 88.0 - (position % 5) * 1.2

        # 예시 취약 구간 1: 6~9번 주변을 낮은 pLDDT로 표시합니다.
        if 6 <= position <= 9:
            score = 66.0 - abs(position - 7) * 2.0

        # 예시 취약 구간 2: 24~28번 주변도 낮은 pLDDT로 표시합니다.
        if 24 <= position <= 28:
            score = 58.0 + (position - 24) * 2.5

        # Gly, Pro, Ala 자체가 무조건 취약하다는 뜻은 아니지만,
        # 콜라겐 반복 구조 탐구를 위해 관심 잔기로 따로 표시합니다.
        if residue in {"G", "P", "A"}:
            score -= 1.0

        scores.append(round(max(0.0, min(100.0, score)), 1))

    return scores


def normalize_plddt_length(
    sequence: str,
    plddt_scores: list[float] | None,
) -> list[float]:
    """pLDDT 점수 개수를 서열 길이에 맞춥니다.

    사용자가 pLDDT를 입력하지 않으면 예시 데이터를 사용합니다. 입력한 pLDDT의 길이가
    서열 길이와 다르면 발표 실습이 끊기지 않도록 부족한 부분은 예시 점수로 채우고,
    너무 긴 부분은 잘라냅니다.
    """
    example_scores = generate_example_plddt_scores(sequence)

    if plddt_scores is None:
        return example_scores

    sequence_length = len(sequence)
    if len(plddt_scores) == sequence_length:
        return plddt_scores

    if len(plddt_scores) < sequence_length:
        missing_count = sequence_length - len(plddt_scores)
        print(f"알림: pLDDT 점수가 {missing_count}개 부족하여 예시 점수로 채웁니다.")
        return plddt_scores + example_scores[len(plddt_scores):]

    print("알림: pLDDT 점수가 서열보다 길어 초과 점수는 사용하지 않습니다.")
    return plddt_scores[:sequence_length]


# -----------------------------
# 4. 분석 보조 함수
# -----------------------------

def find_low_plddt_regions(
    plddt_scores: list[float],
    threshold: float = LOW_PLDDT_THRESHOLD,
) -> list[tuple[int, int]]:
    """pLDDT가 기준값보다 낮은 연속 구간을 찾습니다."""
    regions: list[tuple[int, int]] = []
    start: int | None = None

    for position, score in enumerate(plddt_scores, start=1):
        if score < threshold and start is None:
            start = position
        elif score >= threshold and start is not None:
            regions.append((start, position - 1))
            start = None

    if start is not None:
        regions.append((start, len(plddt_scores)))

    return regions


def position_in_ranges(position: int, ranges: list[tuple[int, int]]) -> bool:
    """특정 위치가 사용자 지정 취약 구간 안에 들어가는지 확인합니다."""
    return any(start <= position <= end for start, end in ranges)


def calculate_vulnerability_scores(
    sequence: str,
    plddt_scores: list[float],
    custom_ranges: list[tuple[int, int]],
) -> list[float]:
    """서열 위치별 탐구용 취약도 점수를 계산합니다.

    점수 구성:
    - pLDDT가 낮을수록 구조 신뢰도가 낮다고 보고 점수를 올립니다.
    - Gly/Pro는 콜라겐 반복 구조에서 중요하지만 주변 연결력이 상대적으로 낮은
      지점으로 해석해 취약도 가중치를 줍니다.
    - Ala는 작은 곁사슬로 인한 유연성 가능성을 반영해 작은 가중치를 줍니다.
    - 사용자가 지정한 취약 구간에는 추가 가중치를 줍니다.

    이 점수는 실제 변성 확률이 아니라 시각화를 위한 단순 지표입니다.
    """
    scores: list[float] = []

    for position, (residue, plddt) in enumerate(zip(sequence, plddt_scores), start=1):
        low_confidence_component = (100.0 - plddt) / 100.0
        low_connectivity_component = 0.18 if residue in {"G", "P"} else 0.0
        collagen_residue_component = 0.08 if residue == "A" else 0.0
        custom_range_component = 0.25 if position_in_ranges(position, custom_ranges) else 0.0

        vulnerability_score = (
            low_confidence_component
            + low_connectivity_component
            + collagen_residue_component
            + custom_range_component
        )
        scores.append(round(min(1.0, vulnerability_score), 3))

    return scores


def summarize_collagen_possibility(
    energy_kj_mol: float,
    low_plddt_regions: list[tuple[int, int]],
    custom_ranges: list[tuple[int, int]],
) -> str:
    """에너지 평가와 구조 지표를 연결해 콜라겐 변성 가능성을 정성적으로 설명합니다."""
    has_structural_flags = bool(low_plddt_regions or custom_ranges)

    if energy_kj_mol >= 400 and has_structural_flags:
        return "고에너지 UV와 구조적 취약 표시 구간이 함께 있어 변성 가능성을 높게 가정해 볼 수 있음"
    if energy_kj_mol >= 400:
        return "고에너지 UV이므로 결합 손상 가능성은 크지만, 서열 취약 구간과는 별도 해석 필요"
    if energy_kj_mol >= 300 and has_structural_flags:
        return "단백질 손상에 관여할 수 있는 에너지와 구조적 취약 표시 구간이 함께 관찰됨"
    if energy_kj_mol >= 300:
        return "에너지는 단백질 손상에 관여할 수 있는 범위이나, 구조 정보와 함께 조심스럽게 해석"
    if has_structural_flags:
        return "에너지는 상대적으로 낮지만, 낮은 pLDDT 또는 지정 취약 구간은 별도로 관찰됨"
    return "에너지가 상대적으로 낮고 뚜렷한 구조적 취약 표시도 적은 탐구 조건"


def format_regions(regions: list[tuple[int, int]]) -> str:
    """연속 구간 목록을 발표 자료에 넣기 쉬운 문자열로 바꿉니다."""
    if not regions:
        return "없음"
    return ", ".join(
        str(start) if start == end else f"{start}-{end}"
        for start, end in regions
    )


def format_positions(positions: list[int]) -> str:
    """아미노산 위치 목록을 읽기 쉬운 문자열로 바꿉니다."""
    if not positions:
        return "없음"
    return ", ".join(str(position) for position in positions)


# -----------------------------
# 5. 그래프 함수
# -----------------------------

def plot_wavelength_energy(
    selected_wavelength_nm: float | None = None,
    output_path: str = "uv_energy_graph.png",
) -> Path:
    """100~400 nm 범위에서 파장별 광자 1몰당 에너지 그래프를 저장합니다."""
    wavelengths = list(range(100, 401))
    energies = [calculate_uv_energy(wavelength) for wavelength in wavelengths]

    fig, ax = plt.subplots(figsize=(10, 6))

    # UV 영역을 배경색으로 구분합니다.
    ax.axvspan(315, 400, color="#8ecae6", alpha=0.28, label="UV-A")
    ax.axvspan(280, 315, color="#ffb703", alpha=0.28, label="UV-B")
    ax.axvspan(100, 280, color="#fb8500", alpha=0.22, label="UV-C")

    ax.plot(wavelengths, energies, color="#1d3557", linewidth=2.4, label="에너지(kJ/mol)")
    ax.axhline(300, color="#6c757d", linestyle="--", linewidth=1, label="300 kJ/mol 기준")
    ax.axhline(400, color="#d00000", linestyle="--", linewidth=1, label="400 kJ/mol 기준")

    if selected_wavelength_nm is not None:
        selected_energy = calculate_uv_energy(selected_wavelength_nm)
        ax.scatter(
            [selected_wavelength_nm],
            [selected_energy],
            color="#d00000",
            s=70,
            zorder=5,
            label=f"입력 파장: {selected_wavelength_nm:g} nm",
        )
        ax.annotate(
            f"{selected_energy:.1f} kJ/mol",
            xy=(selected_wavelength_nm, selected_energy),
            xytext=(8, 10),
            textcoords="offset points",
            fontsize=10,
            color="#d00000",
        )

    ax.set_title("자외선 파장에 따른 광자 1몰당 에너지", fontsize=15, pad=14)
    ax.set_xlabel("파장 (nm)")
    ax.set_ylabel("에너지 (kJ/mol)")
    ax.set_xlim(100, 400)
    ax.grid(alpha=0.25)
    ax.legend(loc="upper right", fontsize=9)

    fig.tight_layout()
    saved_path = Path(output_path)
    fig.savefig(saved_path, dpi=180)
    plt.close(fig)
    return saved_path


def plot_sequence_vulnerability(
    sequence: str,
    plddt_scores: list[float],
    custom_ranges: list[tuple[int, int]] | None = None,
    output_path: str = "sequence_vulnerability_graph.png",
) -> Path:
    """서열 위치별 pLDDT와 탐구용 취약도 점수를 함께 표시합니다."""
    if custom_ranges is None:
        custom_ranges = []

    sequence = clean_sequence(sequence)
    vulnerability_scores = calculate_vulnerability_scores(
        sequence,
        plddt_scores,
        custom_ranges,
    )
    positions = list(range(1, len(sequence) + 1))

    fig, ax1 = plt.subplots(figsize=(12, 6))

    # 막대그래프: 탐구용 취약도 점수
    bar_colors = [
        "#e63946" if score >= 0.5 else "#457b9d"
        for score in vulnerability_scores
    ]
    ax1.bar(
        positions,
        vulnerability_scores,
        color=bar_colors,
        alpha=0.72,
        label="탐구용 취약도 점수",
    )
    ax1.set_xlabel("서열 위치")
    ax1.set_ylabel("탐구용 취약도 점수 (0~1)")
    ax1.set_ylim(0, 1.05)
    ax1.grid(axis="y", alpha=0.25)

    # 낮은 pLDDT 구간과 사용자 지정 구간을 배경으로 표시합니다.
    low_regions = find_low_plddt_regions(plddt_scores)
    for start, end in low_regions:
        ax1.axvspan(start - 0.5, end + 0.5, color="#ffd166", alpha=0.28)

    for start, end in custom_ranges:
        ax1.axvspan(start - 0.5, end + 0.5, color="#8338ec", alpha=0.16)

    # 꺾은선그래프: pLDDT 점수
    ax2 = ax1.twinx()
    ax2.plot(
        positions,
        plddt_scores,
        color="#2a9d8f",
        marker="o",
        markersize=3.5,
        linewidth=1.7,
        label="pLDDT",
    )
    ax2.axhline(
        LOW_PLDDT_THRESHOLD,
        color="#6c757d",
        linestyle="--",
        linewidth=1,
        label=f"낮은 pLDDT 기준({LOW_PLDDT_THRESHOLD:g})",
    )
    ax2.set_ylabel("pLDDT 점수")
    ax2.set_ylim(0, 100)

    # Gly/Pro/Ala 위치는 축 아래쪽에 문자로 표시합니다.
    for position, residue in zip(positions, sequence):
        if residue in {"G", "P", "A"}:
            ax1.text(
                position,
                -0.055,
                residue,
                ha="center",
                va="top",
                fontsize=8,
                color="#1d3557",
                clip_on=False,
            )

    ax1.set_title("COL1A1 일부 서열의 위치별 취약도 분석", fontsize=15, pad=14)
    ax1.set_xticks(positions)
    ax1.set_xticklabels(positions, fontsize=8)

    # 양쪽 축의 범례를 하나로 합칩니다.
    handles1, labels1 = ax1.get_legend_handles_labels()
    handles2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(handles1 + handles2, labels1 + labels2, loc="upper right", fontsize=9)

    fig.tight_layout()
    saved_path = Path(output_path)
    fig.savefig(saved_path, dpi=180)
    plt.close(fig)
    return saved_path


# -----------------------------
# 6. 출력 함수
# -----------------------------

def print_analysis_result(
    wavelength_nm: float,
    sequence: str,
    plddt_scores: list[float],
    custom_ranges: list[tuple[int, int]],
    energy_graph_path: Path,
    vulnerability_graph_path: Path,
) -> None:
    """계산 결과를 발표용 문장으로 출력합니다."""
    energy_kj_mol = calculate_uv_energy(wavelength_nm)
    uv_type = classify_uv(wavelength_nm)
    damage_potential = evaluate_damage_potential(energy_kj_mol)
    residue_positions = analyze_sequence(sequence)
    low_plddt_regions = find_low_plddt_regions(plddt_scores)
    collagen_possibility = summarize_collagen_possibility(
        energy_kj_mol,
        low_plddt_regions,
        custom_ranges,
    )

    print("\n=== 자외선-콜라겐 가능성 분석 결과 ===")
    print(f"입력 파장: {wavelength_nm:g} nm")
    print(f"UV 종류: {uv_type}")
    print(f"광자 1몰당 에너지: {energy_kj_mol:.2f} kJ/mol")
    print(f"결합 손상 가능성 평가: {damage_potential}")

    print("\n=== COL1A1 일부 서열 분석 ===")
    print(f"서열: {sequence}")
    print(f"Gly(G) 위치: {format_positions(residue_positions['G'])}")
    print(f"Pro(P) 위치: {format_positions(residue_positions['P'])}")
    print(f"Ala(A) 위치: {format_positions(residue_positions['A'])}")
    print(f"낮은 pLDDT 구간(<{LOW_PLDDT_THRESHOLD:g}): {format_regions(low_plddt_regions)}")
    print(f"사용자 지정 취약 구간: {format_regions(custom_ranges)}")

    print("\n=== 흐름 요약 ===")
    print(
        f"{wavelength_nm:g} nm 자외선 -> {energy_kj_mol:.2f} kJ/mol -> "
        f"{damage_potential} -> {collagen_possibility}"
    )

    print("\n=== 저장된 그래프 ===")
    print(f"파장별 에너지 그래프: {energy_graph_path}")
    print(f"서열 위치별 취약도 그래프: {vulnerability_graph_path}")

    print("\n=== 탐구 한계 ===")
    print("1. 이 결과는 실제 단백질 변성 예측이 아니라 교육용 가능성 분석입니다.")
    print("2. AlphaFold는 정적인 구조 예측 도구이므로 실제 UV 변성 과정을 직접 시뮬레이션하지 못합니다.")
    print("3. pLDDT가 낮다는 것은 구조 예측 신뢰도가 낮다는 뜻이며, 곧바로 변성이 잘 된다는 뜻은 아닙니다.")
    print("4. 실제 변성은 조사 시간, UV 세기, 온도, 용매, 산소, 주변 분자 환경의 영향을 함께 받습니다.")
    print("5. 따라서 이 프로그램은 생체 실험이 아니라 계산과 시각화를 위한 탐구용 모델로 해석해야 합니다.")


# -----------------------------
# 7. main 함수
# -----------------------------

def main() -> None:
    """프로그램 전체 실행 흐름입니다."""
    wavelength_text = prompt_with_default(
        "자외선 파장(nm)을 입력하세요",
        str(DEFAULT_WAVELENGTH_NM),
    )
    sequence_text = prompt_with_default(
        "COL1A1 아미노산 서열 일부를 입력하세요",
        DEFAULT_SEQUENCE,
    )
    plddt_text = prompt_with_default(
        "pLDDT 점수 리스트를 입력하세요. 비우면 예시 pLDDT를 사용합니다",
        "",
    )
    custom_ranges_text = prompt_with_default(
        "사용자 지정 취약 구간을 입력하세요. 예: 5-9, 22-26. 비우면 없음",
        "",
    )

    try:
        wavelength_nm = float(wavelength_text)
        sequence = clean_sequence(sequence_text)
        parsed_plddt_scores = parse_plddt_scores(plddt_text)
        plddt_scores = normalize_plddt_length(sequence, parsed_plddt_scores)
        custom_ranges = parse_custom_ranges(custom_ranges_text)
    except ValueError as error:
        print(f"입력 오류: {error}")
        return

    energy_graph_path = plot_wavelength_energy(selected_wavelength_nm=wavelength_nm)
    vulnerability_graph_path = plot_sequence_vulnerability(
        sequence,
        plddt_scores,
        custom_ranges=custom_ranges,
    )

    print_analysis_result(
        wavelength_nm=wavelength_nm,
        sequence=sequence,
        plddt_scores=plddt_scores,
        custom_ranges=custom_ranges,
        energy_graph_path=energy_graph_path,
        vulnerability_graph_path=vulnerability_graph_path,
    )


if __name__ == "__main__":
    main()
