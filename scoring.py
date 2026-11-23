"""Deterministic exhibition scoring in pleasure, arousal and dominance."""
from math import dist, floor, sqrt

# Keep the existing TouchDesigner 'regret' channel for the 矛盾 model.
ANCHORS = {
    'sadness': (-2, -1, -1),
    'joy': (2, 1, 1),
    'regret': (0, 2, -1),
    'rejection': (-2, 1, 2),
    'nostalgia': (.5, -1, -1),
    'attachment': (1, 1, -1),
}
EMOTIONS = tuple(ANCHORS)

# In question/option order. Each row contains PAD, primary, secondary and its weight.
OPTIONS = (
    (((-1.8,-1,-1), 'sadness','nostalgia',.5), ((.45,-.9,-1), 'nostalgia','sadness',1),
     ((1,.8,-1), 'attachment','nostalgia',.7), ((-.15,1.8,-1), 'regret','rejection',.7)),
    (((1.55,.45,1.35), 'joy','attachment',.5), ((-1.2,.65,-1.7), 'sadness','regret',1.1),
     ((-1.45,.7,1.85), 'rejection',None,0), ((-.2,1.65,-1.35), 'regret','rejection',.6)),
    (((1.95,1.65,1.2), 'joy','attachment',.6), ((.8,-.7,-.85), 'nostalgia','attachment',1.15),
     ((-1.6,.05,-1.15), 'sadness','regret',.7), ((.05,1.85,-1.05), 'regret','attachment',.65)),
    (((-1.75,-1.55,-1.25), 'sadness',None,0), ((1.8,1.6,1.1), 'joy',None,0),
     ((-.15,1.95,-1.1), 'regret',None,0), ((-1.65,1.5,1.3), 'rejection','regret',.45)),
    (((.65,-1.25,-.65), 'nostalgia','attachment',.9), ((1.1,.9,-1), 'attachment','nostalgia',.6),
     ((1.15,.85,1.9), 'joy','attachment',.5), ((-1.45,.75,1.95), 'rejection',None,0)),
    (((-1.9,-1.15,-1.4), 'sadness','nostalgia',.45), ((.65,-1,-.85), 'nostalgia','attachment',.45),
     ((.95,1.2,-.8), 'attachment','regret',.5), ((-.25,1.65,-1.2), 'regret','attachment',.85)),
)
MAX_DISTANCE = sqrt(48)  # opposite corners of the [-2, 2] PAD cube


def contribution(option, emotion):
    pad, primary, secondary, secondary_weight = option
    weight = 3 if emotion == primary else secondary_weight if emotion == secondary else 0
    bonus = 1.2 * max(0, 1 - dist(pad, ANCHORS[emotion]) / MAX_DISTANCE)
    return weight + bonus


THEORETICAL_MAX = {
    emotion: sum(max(contribution(option, emotion) for option in question) for question in OPTIONS)
    for emotion in EMOTIONS
}


def score_answers(answers):
    if not isinstance(answers, list) or len(answers) != len(OPTIONS):
        raise ValueError('Expected six answers')
    if any(type(answer) is not int or not 0 <= answer < 4 for answer in answers):
        raise ValueError('Invalid answer')
    selected = [question[answer] for question, answer in zip(OPTIONS, answers)]
    totals = {key: sum(contribution(option, key) for option in selected) for key in EMOTIONS}
    ranked = sorted(EMOTIONS, key=totals.get, reverse=True)
    top = ranked[:3]
    exact = {key: 100 * totals[key] / sum(totals[item] for item in top) for key in top}
    display = {key: floor(exact[key]) for key in top}
    leftovers = 100 - sum(display.values())
    for key in sorted(top, key=lambda item: exact[item] - display[item], reverse=True)[:leftovers]:
        display[key] += 1
    return {
        'scores': {key: round(100 * totals[key] / THEORETICAL_MAX[key]) for key in EMOTIONS},
        'topThree': [{'id': key, 'percent': display[key]} for key in top],
        'dominant': ranked[0],
        'pad': dict(zip(('pleasure', 'arousal', 'dominance'), (
            round(sum(option[0][axis] for option in selected) / len(selected), 4)
            for axis in range(3)
        ))),
    }
