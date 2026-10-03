import json, os, sys
from pathlib import Path

SPLITTER = Path(os.environ.get('ATL_SPLITTER_ROOT', r'D:\\Projects\\Audio Album Splitter AI'))
sys.path.insert(0, str(SPLITTER))

from core.audio_info import read_audio_info
from core.audio.source_timeline import AudioSource, SourceTimeline
from core.analysis.candidate_selector import HighestConfidenceSelector
from core.analysis.marker_policy import DEFAULT_MARKER_GROUP_DISTANCE
from core.analysis.models.analysis_result import SourceAnalysisResult
from core.analysis.models.detection import Detection
from core.analysis.models.level_analysis import (
    HistogramModeDiagnostic, LevelAnalysisDiagnostics,
    ShallowGapRejectionDiagnostic, SilenceBoundaryDiagnostic,
)
from core.ai.boundary_evidence_analyzer import BoundaryEvidenceAnalyzer
from core.ai.detector_gap_evidence import attach_detector_gaps
from core.ai.openai_review_client import AI_REVIEW_FORMAT
from core.ai.prompt_builder import SYSTEM_INSTRUCTIONS, build_review_input
from core.ai.review_models import AIReviewRequest, AIReviewResult
from core.ai.review_pipeline import build_album_shortlist


def fail(message):
    raise ValueError(message)


def read_stdin():
    try:
        return json.loads(sys.stdin.read() or '{}')
    except json.JSONDecodeError as exc:
        raise ValueError('Invalid AI review bridge input') from exc


def rebuild_diagnostics(raw):
    if raw is None:
        return None
    if not isinstance(raw, dict):
        fail('Invalid Analyze diagnostics')
    data = dict(raw)
    data['boundaries'] = tuple(SilenceBoundaryDiagnostic(**item) for item in data.get('boundaries', ()))
    data['histogram_modes'] = tuple(HistogramModeDiagnostic(**item) for item in data.get('histogram_modes', ()))
    data['shallow_gap_rejections'] = tuple(ShallowGapRejectionDiagnostic(**item) for item in data.get('shallow_gap_rejections', ()))
    return LevelAnalysisDiagnostics(**data)

def rebuild_result(raw, source_id):
    if not isinstance(raw, dict) or raw.get('source_id') != source_id:
        fail('Analyze result does not match the uploaded source')
    detections = []
    for item in raw.get('detections', ()):
        if not isinstance(item, dict):
            fail('Invalid Analyze detection')
        detections.append(Detection(
            frame=int(item.get('frame', 0)),
            time=float(item['time']),
            confidence=float(item['confidence']),
            source=str(item.get('source', '')),
        ))
    if not detections:
        fail('Analyze produced no candidates for AI Review')
    return SourceAnalysisResult(
        source_id=source_id,
        detections=tuple(detections),
        level_diagnostics=rebuild_diagnostics(raw.get('level_diagnostics')),
    )


def prepare(filepath, raw):
    info = read_audio_info(filepath)
    source = AudioSource.from_metadata(info)
    result = rebuild_result(raw, source.source_id)
    timeline = SourceTimeline((source,))
    shortlist = build_album_shortlist(
        (result,), timeline,
        max_distance=DEFAULT_MARKER_GROUP_DISTANCE,
        selector=HighestConfidenceSelector(),
    )
    analyzer = BoundaryEvidenceAnalyzer()
    evidence = analyzer.analyze(shortlist.entries, timeline.sources)
    evidence = attach_detector_gaps(evidence, (result,))
    request = AIReviewRequest.from_evidence(
        evidence,
        policy=analyzer.policy,
        project_label=source.filename,
        context='Audio Tech Labs Web Demo Analyze V2 review',
    )
    candidates = []
    for index, (snapshot, entry) in enumerate(zip(request.candidates, shortlist.entries)):
        candidates.append({
            'candidateIndex': index,
            'fullCandidateIndex': entry.full_candidate_index,
            'time': snapshot.global_time,
            'localTime': snapshot.local_time,
            'sourceId': snapshot.source_id,
            'selectedDetector': snapshot.selected_detector,
            'selectedConfidence': snapshot.selected_confidence,
            'detectors': list(dict.fromkeys(item.detector for item in snapshot.evidence)),
        })
    return {
        'instructions': SYSTEM_INSTRUCTIONS,
        'input': build_review_input(request),
        'format': AI_REVIEW_FORMAT,
        'candidateCount': len(request.candidates),
        'shortlist': {
            'before': shortlist.before_count,
            'selected': shortlist.selected_count,
            'nonEmptyWindows': shortlist.non_empty_windows,
            'coveredWindows': shortlist.covered_windows,
            'uncoveredWindows': shortlist.uncovered_windows,
            'policy': shortlist.policy.description,
        },
        'candidates': candidates,
    }

def validate(raw):
    if not isinstance(raw, dict):
        fail('Invalid AI review validation input')
    count = raw.get('candidateCount')
    output_text = raw.get('outputText')
    if not isinstance(count, int) or isinstance(count, bool) or count < 1:
        fail('Invalid AI review candidate count')
    if not isinstance(output_text, str) or not output_text.strip():
        fail('OpenAI response did not contain review output')
    try:
        payload = json.loads(output_text)
    except json.JSONDecodeError as exc:
        raise ValueError('OpenAI returned an invalid AI review payload') from exc
    result = AIReviewResult.from_mapping(payload)
    expected = set(range(count))
    actual = {item.candidate_index for item in result.items}
    if len(result.items) != count or actual != expected:
        fail('AI review must contain exactly one item for every candidate')
    return {
        'summary': result.summary,
        'items': [
            {
                'candidateIndex': item.candidate_index,
                'recommendation': item.recommendation.value,
                'confidence': item.confidence,
                'rationale': item.rationale,
                'reasonCode': item.reason_code.value,
            }
            for item in result.items
        ],
    }


def main():
    if len(sys.argv) != 3:
        raise SystemExit('usage: ai-review-bridge.py <audio-file> <prepare|validate>')
    filepath = os.path.abspath(sys.argv[1])
    mode = sys.argv[2]
    raw = read_stdin()
    if mode == 'prepare':
        output = prepare(filepath, raw)
    elif mode == 'validate':
        output = validate(raw)
    else:
        raise SystemExit('unknown AI review bridge mode')
    print(json.dumps(output, ensure_ascii=False, separators=(',', ':'), allow_nan=False))


if __name__ == '__main__':
    main()
