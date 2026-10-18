# VOID ARK — Steam PC 전투 최적화 작업본

이 저장소는 2026-10-18 PC 최적화 채팅의 소스 체크포인트입니다. Steam 제출본·Google Play 모바일 프로젝트와 별도이며, 출시 승인이나 무끊김 달성을 뜻하지 않습니다.

## 새 컴퓨터에서 시작

Node.js 22.20 이상과 npm, Git을 준비한 뒤 실행하세요.

    git clone https://github.com/niceverygood/VoidArk.git
    cd VoidArk
    npm ci
    npm run build
    npm run play

기본 웹 주소는 http://localhost:4190 입니다. 검수는 별도 origin에서 ?qa=1&qaNoSave=1&qaFresh=1&qaStorageAudit=1 을 사용하고 사용자 플레이 저장에 접근하지 마세요. 포트가 이미 사용 중이면 기존 서버를 강제 종료하지 말고 VOID_ARK_PORT를 지정하세요.

Codex에서 이 폴더를 열고 [CODEX_HANDOFF_PROMPT.txt](CODEX_HANDOFF_PROMPT.txt)의 내용을 새 채팅에 붙여 넣으세요. 같은 계정으로 로그인하더라도 이 컴퓨터의 소스·실행 서버·저장은 Git clone으로 준비해야 합니다. 이 저장소는 채팅 기록이나 인증정보의 복사본이 아닙니다.

## 현재 상태

기본 src163개는 로컬 game-De5_jikA.js / 612검사 체크포인트와 같습니다. 유휴 파편 행렬 계산 감소만 이 PC 후보에 들어 있으며 절감은 약0.01ms입니다. 최신 기준46.50/42.58FPS보다39.00FPS였던 반대 기록도 보존합니다. 무끊김·안정60FPS·Steam native 전투 성능을 입증하지 않았습니다.

투명 투사체 발광 재질 공유는 WORK에만 있으며 미채택으로 확정했습니다. 음소거·HIGH·1280x720·120척의 ABBA 두 비교쌍에서 기준45.62/47.54FPS 대비 후보41.45/42.12FPS였고 p95/p99/max와50·100ms초과도 모두 악화했습니다. 메모리/픽셀 검사 성공은 이 반대 성능 증거를 대체하지 않습니다. 상세는 HANDOFF.md와 qa/projectile-glow-muted-validation.json을 읽으세요.

## 테스트 음소거

최신 사용자 요청에 따라 모든 테스트는 준비 화면부터 음소거로 시작합니다. 이 검수 페이지의 기준/후보/픽셀/일반 조작 모드에 적용했으며 4회 전투·72표본 모두 audio enabled=false, context suspended, voices/loops 0, played={}를 확인했습니다. 제품의 기본 음향과 OS 음량은 변경하지 않습니다. 다른 검수나 native QA도 플레이 전에 정상 UI로 음소거를 적용하고 확인하세요.

## 검사

    npm run test:serial
    npm run assets:verify
    node tools/verify-handoff.mjs

전체 검사는 격리된 메모리 Simulation과 임시 loopback 서버를 포함합니다. 사용자 저장 불변이나 기기 성능 검증으로 확대하지 마세요. test:serial은 이 Git 인계본의 순차 실행 명령입니다. assets:verify는 생성 계획 파일 대신 현재 공개 에셋 manifest의 모든 GLB를 검사합니다. 두 명령 모두 게임 소스와 의존성은 바꾸지 않습니다.

## 선택: Windows 실행본 생성

    npm ci --prefix desktop
    npm run build
    node tools/package-desktop.mjs

Electron44.7.0 잠금파일을 사용하며 생성물은 release 아래에만 생깁니다. 실행본은 Git에 포함하지 않았습니다. 실제 Windows 기기 검수·Steam 업로드·서명·출시는 별도입니다. 기본 native 실행은 기존 VOID ARK 로컬 저장 경로를 사용하므로 자동 QA로 실행하거나 기존 게임을 강제 종료하지 마세요.

## 미채택 발광 후보 재현

    node tools/prepare-glow-workspace.mjs
    node --test work/projectile-glow-pool.test.mjs work/projectile-glow-integration.test.mjs
    npx vite build work/projectile-glow-project --outDir ../projectile-glow-build
    node work/serve-projectile-glow.mjs

별도 검수 페이지: http://127.0.0.1:4276/stress.html?pixel . 기존 public/node_modules를 checkout 안에서만 연결합니다. baseline은 기본 dist를 빌드한 뒤 node work/serve-projectile-glow-baseline.mjs / 4275를 씁니다. 중복 서버와 사용자 origin을 건드리지 마세요. 현재 발광 후보는 성능 역효과로 미채택이므로 같은 실험을 반복하지 마세요. 향후 다른 후보의 FPS 측정은 30초 준비+90초, ABBA 등 반복쌍의 평균·p95/p99/max/50·100ms초과를 모두 보존하고 측정 중 빌드·검사·스크린샷·문서쓰기를 멈추세요.

서명키·토큰·개인 저장·node_modules·dist·Windows 생성 실행본·원본 Steam RC2 ZIP·브라우저 프로필은 제외했습니다. 에셋 생성 도구는 외부 API 비용이 생길 수 있으므로 인계 검수 중 실행하지 마세요.
