"""One File Studio: one text normalizer for every script-vs-transcript comparison (score_takes, vo_assemble, qa).
ASR writes numbers as digits ("$2,500", "30-second"), scripts spell them out ("twenty-five hundred dollars", "thirty-second"):
both sides become the same tokens: ['2500', 'dollars', '30', 'second']."""
import re
NUM = {w: i for i, w in enumerate('zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split())}
NUM.update({w: 10 * (i + 2) for i, w in enumerate('twenty thirty forty fifty sixty seventy eighty ninety'.split())})
def words2num(toks):
    out, cur, any_ = [], 0, False
    for t in toks + ['']:
        if t in NUM: cur += NUM[t]; any_ = True
        elif t == 'hundred' and any_: cur *= 100
        elif t == 'thousand' and any_: cur *= 1000
        else:
            if any_: out.append(str(cur)); cur, any_ = 0, False
            if t: out.append(t)
    return out
AR_DIAC = re.compile('[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]')   # harakat, Quranic marks, tatweel
def ar(s):
    s = AR_DIAC.sub('', s).translate(str.maketrans('أإآٱىةؤئ٠١٢٣٤٥٦٧٨٩', 'ااااياوي0123456789'))
    return s
def tokens(s):
    if re.search('[\u0600-\u06ff]', s):                        # Arabic: strip harakat, unify alef/ya/ta marbuta, keep letters
        s = ar(re.sub(r'\[[^\]]*\]', '', s)); return re.sub('[^\u0621-\u064a0-9a-z ]', ' ', s.lower()).split()
    s = re.sub(r'\[[^\]]*\]', '', s).lower()                      # drop [tone tags]
    s = re.sub(r'\$\s*(\d[\d ,]*)', r'\1 dollars ', s)            # $2,500 -> 2500 dollars
    s = re.sub(r'(\d)\s*,\s*(\d{3})', r'\1\2', s).replace('-', ' ')
    return words2num(re.sub(r'[^a-z0-9 ]', '', s).split())
