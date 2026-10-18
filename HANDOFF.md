# 최신 인수인계 — 2026-10-18 Steam PC

먼저 CODEX_HANDOFF_PROMPT.txt, AGENTS.md, qa/PC_OPTIMIZATION_20261018_STATE.json, qa/PC_OPTIMIZATION_20261018_PROGRESS.txt와 PC최적화검수결과.txt를 읽으세요. 과거 절대 경로는 원본 컴퓨터의 증거 출처이며 새 컴퓨터에서 만들거나 접근할 경로가 아닙니다.

기본 제품: src163개 / game-De5_jikA.js / 기존612검사. effects.js 유휴chunk행렬 한 구간 외162개는 pinned source와 동일합니다. ZIP474·538/SteamRC2/모바일 동결AAB 변경 없음. Windows 실행본은 원본 컴퓨터에만 유지했고 이 Git에는 소스와 에셋을 넣었습니다.

완료/미채택:
- Session02 callback 경계진단: profiler 집계 .0186ms로 큰 병목 근거 없음. 긴raw24건 직전작업우세18/뒤간격6. 진단FPS30.05는 개선 비교가 아님.
- Session03 렌더sort .0955ms로 교체 미착수, primaryindex .7713ms(보조화면 뒤 복구 포함).
- Session04 DFS index 후보는 실제8쌍 모두 느려 미채택(.253→.582ms).
- Session05 발광 공유는 WORK에만. 일반 ProjectileVisuals default는 private, main만 공통 frame time을 전제로 opt-in. body재질·Object3D·움직임/wake/GLB 소유 유지. helper4+실제class4 통과. Node factory에서는 sparse12 rate 평균악화·dense60/240 평균개선이나 일부max악화. 실제 browser25GLB/3색/69bindings에서 main/PIP 모든RGBA차이0·calls272/triangles1454993 동일·원래renderer복원·clear뒤entries0/refs0/created46=released46. 전후전투반복90초/context/native는 미완료.
- Session06 별도 원본 채팅의 Unit61 계측300초 기록 읽기 분석. >100ms25건 중 직전작업우세21/뒤간격4; 최장364.2=213+151.2ms. 같은 시간 이 채팅 WORK 빌드mtime이 겹쳐 host격리 주장 없음. 원본31MB trace는 복사하지 않았고 SHA·선택scalar만 qa/reference-hitch-trace-analysis.json에 있음. 원본의 뒤 단위 작업과 중복되지 않게 주의.
- Session07 만료wake alpha0 shortcut은25메모리oracle 통과하나1961active 절감.007786ms로 gate.1ms 미달, 미채택.
- Session08 identity-left 행렬 kernel4검사 통과. 평균gate는native123ms outlier로 수치상pass이나 medianpair절감.032ms/5000평균퇴행·일부tail악화여서 미채택. 숫자·outlier를 제외하거나 gate를 사후 변경하지 않음.

이미미채택인 particle active-list·무기 계산·default-low강제/performanceCLI·원본Unit4추진부parent재사용·Unit28버리는quaternion·Unit32thrusterpow재사용·Unit36ancestorMap/epoch·Unit41flamepacking·Unit44identitycompose·Unit47affine검토를 반복하지 마세요. 원본 야간 채택은 Unit2 typedarrayview/7healthbarbatch/23hiddenworldguard뿐이며 이미 현재소스에 포함됩니다.

다음 가치 있는 작업: 현재 WORK발광 후보를 실제 기존/후보 교대90초 반복쌍과 긴프레임으로 비교. 평균만 나아지고p95/p99/max/100ms초과가 악화되면 채택하지 않음. 현재픽셀1장면 성공을 전체6look/모든자세/GPU복구/실기기로 확대하지 않음. 별도새컴퓨터 실측은 원래컴퓨터 수치와 분리.

원본의72척90초57.63FPS는72척5분max203.5ms/120척5분max808.8ms를 대체하지 않습니다. 보존SHA SteamRC2 d3473d439d4dd2c06e38e605e076a4e2006a08c34c1dc10b110232a6c1e643e5.

예약마감은2026-10-18 22:00KST/13:00UTC,21:45큰작업중단입니다. 이 저장소를 받는 시점이 마감 뒤라면 새성능개발을 시작하지 말고 기존 완료·미완료를 보고한 뒤 새기간지시를 받으세요. 이 Git이 다른컴퓨터에 기존로컬자동화를 복제하거나 새예약을 생성하지는 않습니다. 같은계정의 다른프로젝트·자동화·채팅은 변경하지 마세요.

qa/EXPORT_MANIFEST.json은 복사한 source/public/tests 등의SHA입니다. qa/GITHUB_HANDOFF_VALIDATION.json은 이 Git 체크포인트의 실제 확인 범위입니다. 원래머신 경로·PID·tabID·과거entry는 provenance이며 새컴퓨터의 현재실행값이 아닙니다.
