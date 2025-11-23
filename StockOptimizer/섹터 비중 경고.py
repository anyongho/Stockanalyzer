import pandas as pd
import numpy as np
from datetime import datetime

def connected_components_from_adj(adj):
    n = adj.shape[0]
    visited = [False]*n
    comps = []
    for i in range(n):
        if not visited[i]:
            stack = [i]
            comp = []
            visited[i] = True
            while stack:
                u = stack.pop()
                comp.append(u)
                for v in range(n):
                    if adj[u, v] and not visited[v]:
                        visited[v] = True
                        stack.append(v)
            comps.append(comp)
    return comps

def check_portfolio_rules(sector_weights, verbose=False):
    """
    sector_weights: dict {sector_name: weight_percent} 합계는 100 허용
    """
    sectors = list(sector_weights.keys())
    weights = np.array([sector_weights[s] for s in sectors], dtype=float)
    weights = weights / weights.sum() * 100
    weight_series = pd.Series(weights, index=sectors)

    report = {
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'input_weights': weight_series.to_dict(),
        'checks': [],
        'summary': {}
    }

    # -------------------- RULE 1: 단일 섹터 --------------------
    max_idx = np.argmax(weights)
    max_sector = sectors[max_idx]
    max_weight = weights[max_idx]
    if max_weight > 40.0:
        status = 'HARD_VIOLATION'
    elif max_weight > 30.0:
        status = 'SOFT_WARNING'
    else:
        status = 'OK'
    report['checks'].append({
        'rule': 1,
        'status': status,
        'sector': max_sector,
        'value': round(max_weight,2),
        'message': f"단일 섹터 '{max_sector}' 비중: {max_weight:.2f}%"
    })

    # -------------------- RULE 2: 상관군 --------------------
    # 사전 정의 상관계수 (간단화)
    # 대략 산업별 상관 높은 그룹 설정 (0.65~0.8)
    corr_matrix = np.identity(len(sectors))
    high_corr_pairs = [
        ("Information Technology","Communication Services"),
        ("Energy","Materials"),
        ("Consumer Staples","Health Care"),
        ("Industrials","Financials"),
        ("Consumer Discretionary","Communication Services")
    ]
    for s1, s2 in high_corr_pairs:
        i = sectors.index(s1)
        j = sectors.index(s2)
        corr_matrix[i,j] = corr_matrix[j,i] = 0.7

    # 상관군 찾기
    adj = (corr_matrix > 0.6).astype(int)
    np.fill_diagonal(adj, 0)
    comps = connected_components_from_adj(adj.astype(bool))
    comp_infos = []
    corr_violations = []
    for comp in comps:
        comp_sectors = [sectors[i] for i in comp]
        comp_weight = weight_series[comp_sectors].sum()
        avg_corr = corr_matrix[np.ix_(comp, comp)][np.triu_indices(len(comp), k=1)].mean() if len(comp)>1 else 1.0
        comp_infos.append({'members': comp_sectors, 'weight_sum': round(float(comp_weight),2), 'avg_corr': round(avg_corr,3)})
        if comp_weight > 60:
            corr_violations.append({'status':'HARD_VIOLATION','members':comp_sectors,'weight_sum':round(float(comp_weight),2),'avg_corr':round(avg_corr,3)})
        elif comp_weight > 50:
            corr_violations.append({'status':'SOFT_WARNING','members':comp_sectors,'weight_sum':round(float(comp_weight),2),'avg_corr':round(avg_corr,3)})

    report['checks'].append({
        'rule': 2,
        'status': 'ANALYZED',
        'components': comp_infos,
        'violations': corr_violations,
        'message': f"상관군 분석 완료. 군 수: {len(comp_infos)}"
    })

    # -------------------- RULE 3: 방어 섹터 --------------------
    defensive = ['Consumer Staples','Health Care','Utilities']
    defensive_sum = weight_series[[s for s in defensive if s in sectors]].sum()
    if defensive_sum < 5:
        status = 'HARD_VIOLATION'
    elif defensive_sum < 10:
        status = 'SOFT_WARNING'
    else:
        status = 'OK'
    report['checks'].append({
        'rule': 3,
        'status': status,
        'value': round(float(defensive_sum),2),
        'message': f"방어 섹터 합계: {defensive_sum:.2f}% (권장 최소: 15%)"
    })

    # -------------------- RULE 4: REITs --------------------
    reits = [s for s in sectors if 'Real Estate' in s]
    reit_sum = weight_series[reits].sum() if reits else 0
    if reit_sum > 20:
        status = 'HARD_VIOLATION'
    elif reit_sum > 15:
        status = 'SOFT_WARNING'
    else:
        status = 'OK'
    report['checks'].append({
        'rule': 4,
        'status': status,
        'value': round(float(reit_sum),2),
        'message': f"REITs 합계: {reit_sum:.2f}% (권장 상한: 20%)"
    })

    # -------------------- RULE 5: Energy+Materials --------------------
    em = [s for s in ['Energy','Materials'] if s in sectors]
    em_sum = weight_series[em].sum() if em else 0
    if em_sum > 25:
        status = 'HARD_VIOLATION'
    elif em_sum > 20:
        status = 'SOFT_WARNING'
    elif em_sum > 15:
        status = 'ADVISORY'
    else:
        status = 'OK'
    report['checks'].append({
        'rule': 5,
        'status': status,
        'value': round(float(em_sum),2),
        'message': f"Energy+Materials 합계: {em_sum:.2f}%"
    })

    # -------------------- SUMMARY --------------------
    hard_violations = [c for c in report['checks'] if c.get('status') == 'HARD_VIOLATION']
    soft_warnings = [c for c in report['checks'] if c.get('status') == 'SOFT_WARNING']
    report['summary'] = {
        'hard_violations_count': len(hard_violations),
        'soft_warnings_count': len(soft_warnings),
        'hard_violations': hard_violations,
        'soft_warnings': soft_warnings
    }

    if verbose:
        print("---- RULE CHECK SUMMARY ----")
        print(f"Total sectors: {len(sectors)} | Total weight sum: {round(weights.sum(),2)}%")
        for chk in report['checks']:
            print(f"Rule {chk['rule']}: {chk['status']} - {chk.get('message')}")
    return report

# ------------------ 예시 실행 ------------------
if __name__ == "__main__":
    sector_list = ["Information Technology","Communication Services","Consumer Discretionary",
                   "Consumer Staples","Health Care","Financials","Industrials",
                   "Energy","Materials","Real Estate","Utilities"]

    example_weights = {
        "Information Technology": 28.0,
        "Communication Services": 12.0,
        "Consumer Discretionary": 10.0,
        "Consumer Staples": 6.0,
        "Health Care": 10.0,
        "Financials": 8.0,
        "Industrials": 10.0,
        "Energy": 5.0,
        "Materials": 4.0,
        "Real Estate": 4.0,
        "Utilities": 3.0
    }

    report = check_portfolio_rules(example_weights, verbose=True)

    import json
    print("\n=== Report Summary ===")
    print(json.dumps(report['summary'], indent=2, ensure_ascii=False))
