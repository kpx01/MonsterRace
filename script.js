/**
 * Monster Race GUI - JavaScript Port
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- 定数設定 ---
const WIN_W = 1280, WIN_H = 720;
const STATUS_BAR_Y = 640;
const DIVIDER_Y = 420;
const TERRAIN_Y_TOP = 250;
const FINISH_X = 12000;
const START_X = -100;
const INITIAL_OFFSET = 250;
const SCROLL_THRESHOLD = 600;
const TEAM_SIZE = 3;
const SWAP_LAG_TICKS = 10;
const TICK_MS = 50;

// モンスターデータ
const MONSTER_POOL = [
    { icon: "🦖", name: "爆走恐竜", min_spd: 23, max_spd: 30, max_stamina: 50.0, affinities: { "草原": "◎", "砂漠": "○", "雪原": "△", "火山": "○", "海辺": "△", "宇宙": "○" } },
    { icon: "🐉", name: "砂漠の龍", min_spd: 19, max_spd: 23, max_stamina: 75.0, affinities: { "草原": "△", "砂漠": "△", "雪原": "○", "火山": "◎", "海辺": "◎", "宇宙": "△" } },
    { icon: "🎠", name: "夢幻一角獣", min_spd: 22, max_spd: 28, max_stamina: 60.0, affinities: { "草原": "◎", "砂漠": "○", "雪原": "△", "火山": "△", "海辺": "○", "宇宙": "◎" } },
    { icon: "🐢", name: "古の巨亀", min_spd: 16, max_spd: 18, max_stamina: 130.0, affinities: { "草原": "○", "砂漠": "○", "雪原": "○", "火山": "△", "海辺": "◎", "宇宙": "◎" } },
    { icon: "🐫", name: "砂漠の走者", min_spd: 20, max_spd: 24, max_stamina: 95.0, affinities: { "草原": "○", "砂漠": "◎", "雪原": "△", "火山": "◎", "海辺": "○", "宇宙": "△" } },
    { icon: "🦮", name: "凍土の狼", min_spd: 23, max_spd: 27, max_stamina: 70.0, affinities: { "草原": "○", "砂漠": "◎", "雪原": "◎", "火山": "△", "海辺": "△", "宇宙": "○" } }
];

const TERRAIN_POOL = [
    { name: "草原", color: "#7CFC00", decors: ["🌱", "🌼", "🌷", "🍀"] },
    { name: "砂漠", color: "#F4A460", decors: ["🌵", "☀️", "🏜️", "🦴"] },
    { name: "雪原", color: "#FFFAFA", decors: ["❄️", "⛄", "🧊"] },
    { name: "火山", color: "#FF4500", decors: ["🔥", "🌋", "☄️"] },
    { name: "海辺", color: "#1E90FF", decors: ["🏖️", "🦀", "🐚", "🌴"] },
    { name: "宇宙", color: "#191970", decors: ["🚀", "👽", "👾", "⭐"] }
];

// --- ゲーム状態 ---
let currentScene = "title"; // title, select, race, result
let isRacing = false;
let cameraX = 0;
let p1_team = [], p2_team = [];
let p1_idx = 0, p2_idx = 0;
let cur_pos1 = 0, cur_pos2 = 0;
let m1_stamina = 0, m2_stamina = 0;
let m1_swap_ticks = 0, m2_swap_ticks = 0;
let terrain_configs = [];
let startTime = 0;
let p1_finish_time = null, p2_finish_time = null;
let selectedIndices = [];
let clouds = [];
let decors = [];
let countdownValue = 0;
let countdownActive = false;
let titleMonsters = [];
let lastFrameTime = 0;
let accumulator = 0;

// --- 初期化 ---
function init() {
    // キャンバスの内部解像度を16:9に固定
    canvas.width = WIN_W;
    canvas.height = WIN_H;
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // 雲の初期化
    for (let i = 0; i < 6; i++) {
        clouds.push({ x: Math.random() * WIN_W, y: 100 + Math.random() * 100, icon: "☁️" });
    }
    // タイトル用演出モンスター
    for (let i = 0; i < 4; i++) {
        titleMonsters.push({
            x: -Math.random() * 2000,
            y: 420 + (i % 2) * 80,
            speed: 10 + Math.random() * 15,
            icon: MONSTER_POOL[Math.floor(Math.random() * MONSTER_POOL.length)].icon
        });
    }

    canvas.addEventListener('click', handleCanvasClick);
    requestAnimationFrame(gameLoop);
}

function resizeCanvas() {
    const windowRatio = window.innerWidth / window.innerHeight;
    const gameRatio = WIN_W / WIN_H;

    if (windowRatio > gameRatio) {
        // ウィンドウが横長すぎる場合、高さを基準にする
        canvas.style.height = window.innerHeight + 'px';
        canvas.style.width = (window.innerHeight * gameRatio) + 'px';
    } else {
        // ウィンドウが縦長すぎる場合、幅を基準にする
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = (window.innerWidth / gameRatio) + 'px';
    }
}

function setupRace() {
    cameraX = -INITIAL_OFFSET;
    cur_pos1 = -100; // スタートエリア (-200 〜 0) の中心に配置
    cur_pos2 = -100;
    p1_finish_time = null;
    p2_finish_time = null;

    // 地形生成
    terrain_configs = [];
    for (let i = 0; i < 6; i++) {
        const t = TERRAIN_POOL[Math.floor(Math.random() * TERRAIN_POOL.length)];
        terrain_configs.push({ ...t, start: i * 2000, end: (i + 1) * 2000 });
    }

    // 装飾生成
    decors = [];
    terrain_configs.forEach(t => {
        for (let i = 0; i < 20; i++) {
            decors.push({
                x: t.start + Math.random() * 2000,
                y: 300 + Math.random() * 300,
                icon: t.decors[Math.floor(Math.random() * t.decors.length)]
            });
        }
    });

    // チーム設定 (1Pが選んだ以外を2Pに)
    const allIndices = Array.from(Array(MONSTER_POOL.length).keys());
    const p2Indices = allIndices.filter(i => !selectedIndices.includes(i));

    p1_team = selectedIndices.map(i => ({ ...MONSTER_POOL[i], current_stamina: MONSTER_POOL[i].max_stamina }));
    p2_team = p2Indices.map(i => ({ ...MONSTER_POOL[i], current_stamina: MONSTER_POOL[i].max_stamina }));

    p1_idx = 0; p2_idx = 0;
    m1_stamina = p1_team[0].max_stamina;
    m2_stamina = p2_team[0].max_stamina;
    
    startCountdown();
}

function startCountdown() {
    countdownActive = true;
    countdownValue = 3;
    const timer = setInterval(() => {
        countdownValue--;
        if (countdownValue < 0) {
            clearInterval(timer);
            countdownActive = false;
            isRacing = true;
            startTime = Date.now();
        }
    }, 1000);
}

// --- メインループ ---
function gameLoop(timestamp) {
    if (!lastFrameTime) lastFrameTime = timestamp;
    const deltaTime = timestamp - lastFrameTime;
    lastFrameTime = timestamp;

    // 前回のフレームからの経過時間を蓄積（最大250msに制限して、タブ復帰時の急加速を防止）
    accumulator = Math.min(accumulator + deltaTime, 250);

    // TICK_MS (50ms) が経過するごとに update を実行し、ロジックの進行を一定に保つ
    while (accumulator >= TICK_MS) {
        update();
        accumulator -= TICK_MS;
    }

    draw();
    requestAnimationFrame(gameLoop);
}

function update() {
    if (currentScene === "title") {
        titleMonsters.forEach(m => {
            m.x += m.speed;
            if (m.x > WIN_W + 100) {
                m.x = -500 - Math.random() * 1000;
                m.icon = MONSTER_POOL[Math.floor(Math.random() * MONSTER_POOL.length)].icon;
            }
        });
    }

    if (isRacing && !countdownActive) {
        const getTerrain = (pos) => {
            const t = terrain_configs.find(tc => pos >= tc.start && pos < tc.end);
            if (t) return t.name;
            if (pos < 0) return terrain_configs[0].name; // スタート地点より前は最初の地形として扱う
            return terrain_configs[terrain_configs.length - 1].name;
        };

        // 1P & 2P Movement
        [1, 2].forEach(p => {
            const isP1 = p === 1;
            if ((isP1 && cur_pos1 > FINISH_X + 125) || (!isP1 && cur_pos2 > FINISH_X + 125)) return;

            const team = isP1 ? p1_team : p2_team;
            const idx = isP1 ? p1_idx : p2_idx;
            const monster = team[idx];
            let stamina = isP1 ? m1_stamina : m2_stamina;
            const pos = isP1 ? cur_pos1 : cur_pos2;
            const swapTicks = isP1 ? m1_swap_ticks : m2_swap_ticks;

            const terrain = getTerrain(pos);
            const aff = monster.affinities[terrain] || "○";
            const bonus = aff === "◎" ? 10 : aff === "△" ? -10 : 0;
            const factor = 0.6 + (stamina / monster.max_stamina) * 0.4;
            
            let dx = (Math.floor(Math.random() * (monster.max_spd - monster.min_spd + 1)) + monster.min_spd) * factor + bonus;
            if (swapTicks > 0) dx *= 0.5;

            if (isP1) {
                cur_pos1 += dx;
                m1_stamina = Math.max(0, m1_stamina - 0.15);
                if (m1_swap_ticks > 0) m1_swap_ticks--;
                if (cur_pos1 >= FINISH_X && p1_finish_time === null) p1_finish_time = (Date.now() - startTime) / 1000;
            } else {
                cur_pos2 += dx;
                m2_stamina = Math.max(0, m2_stamina - 0.15);
                if (m2_swap_ticks > 0) m2_swap_ticks--;
                if (cur_pos2 >= FINISH_X && p2_finish_time === null) p2_finish_time = (Date.now() - startTime) / 1000;
                
                // CPU AI Logic
                cpuAI(getTerrain(cur_pos2));
            }
        });

        // Camera Scroll
        if (cur_pos1 - cameraX > SCROLL_THRESHOLD) {
            cameraX = cur_pos1 - SCROLL_THRESHOLD;
        }

        // Race End Check
        if (cur_pos1 > FINISH_X + 125 && cur_pos2 > FINISH_X + 125) {
            isRacing = false;
            setTimeout(() => { currentScene = "result"; }, 1500);
        }
    }

    // 雲の移動
    clouds.forEach(c => {
        c.x -= 0.5;
        if (c.x < -100) c.x = WIN_W + 100;
    });
}

function cpuAI(terrain) {
    if (m2_swap_ticks > 0) return;
    const scoreMap = { "◎": 2, "○": 1, "△": 0 };
    let currentScore = scoreMap[p2_team[p2_idx].affinities[terrain] || "○"];
    if (m2_stamina < 5) currentScore = -1;

    let bestIdx = p2_idx;
    for (let i = 0; i < TEAM_SIZE; i++) {
        if (i === p2_idx) continue;
        if (p2_team[i].current_stamina > 10) {
            let s = scoreMap[p2_team[i].affinities[terrain] || "○"];
            if (s > currentScore) {
                currentScore = s;
                bestIdx = i;
            }
        }
    }
    if (bestIdx !== p2_idx) swapMonster(2, bestIdx);
}

function swapMonster(player, nextIdx) {
    if (player === 1) {
        p1_team[p1_idx].current_stamina = m1_stamina;
        p1_idx = nextIdx;
        m1_stamina = p1_team[p1_idx].current_stamina;
        m1_swap_ticks = SWAP_LAG_TICKS;
    } else {
        p2_team[p2_idx].current_stamina = m2_stamina;
        p2_idx = nextIdx;
        m2_stamina = p2_team[p2_idx].current_stamina;
        m2_swap_ticks = SWAP_LAG_TICKS;
    }
}

// --- 描画系 ---
function draw() {
    ctx.clearRect(0, 0, WIN_W, WIN_H);

    if (currentScene === "title") drawTitle();
    else if (currentScene === "select") drawSelect();
    else if (currentScene === "race") drawRace();
    else if (currentScene === "result") drawResult();
}

function drawTitle() {
    ctx.fillStyle = "#87CEEB";
    ctx.fillRect(0, 0, WIN_W, WIN_H);
    
    // 背景モンスター
    ctx.font = "80px Arial";
    titleMonsters.forEach(m => {
        ctx.fillText(m.icon, m.x, m.y + Math.sin(m.x * 0.05) * 10);
    });

    ctx.fillStyle = "#333";
    ctx.textAlign = "center";
    ctx.font = "bold 120px Arial";
    ctx.fillText("MONSTER RACE", WIN_W / 2, 300);
    ctx.font = "bold 40px Arial";
    ctx.fillText("CLICK START", WIN_W / 2, 420);
}

function drawSelect() {
    ctx.fillStyle = "#F8F8F8";
    ctx.fillRect(0, 0, WIN_W, WIN_H);
    ctx.fillStyle = "#333";
    ctx.textAlign = "center";
    ctx.font = "bold 50px Arial";
    ctx.fillText("CHOOSE YOUR TEAM (SELECT 3)", WIN_W / 2, 100);

    MONSTER_POOL.forEach((m, i) => {
        const col = i % 3, row = Math.floor(i / 3);
        const x = 340 + col * 300, y = 200 + row * 150;
        
        ctx.font = "80px Arial";
        ctx.fillText(m.icon, x, y);
        ctx.font = "bold 24px Arial";
        ctx.fillText(m.name, x, y + 40);
        
        if (selectedIndices.includes(i)) {
            ctx.strokeStyle = "orange";
            ctx.lineWidth = 5;
            ctx.strokeRect(x - 100, y - 70, 200, 130);
        }
    });

    ctx.font = "bold 30px Arial";
    const selectedIcons = selectedIndices.map(i => MONSTER_POOL[i].icon).join(" ");
    ctx.fillText("Selected: " + (selectedIcons || "None"), WIN_W / 2, 550);
    ctx.font = "bold 20px Arial";
    ctx.fillText("アイコンをクリックして選択（3体選ぶと開始）", WIN_W / 2, 600);
}

function drawRace() {
    ctx.fillStyle = "#87CEEB";
    ctx.fillRect(0, 0, WIN_W, WIN_H);

    // 雲
    ctx.font = "50px Arial";
    clouds.forEach(c => ctx.fillText(c.icon, c.x, c.y));

    // 地形とスクロール要素の描画開始
    ctx.save();
    ctx.translate(-cameraX, 0);

    // 地形
    terrain_configs.forEach(t => {
        ctx.fillStyle = t.color;
        ctx.fillRect(t.start, TERRAIN_Y_TOP, t.end - t.start, STATUS_BAR_Y - TERRAIN_Y_TOP);
    });

    // スタート・ゴールエリア
    ctx.fillStyle = "#A9A9A9";
    ctx.fillRect(-200, TERRAIN_Y_TOP, 200, STATUS_BAR_Y - TERRAIN_Y_TOP);
    ctx.fillStyle = "#FFD700";
    ctx.fillRect(FINISH_X, TERRAIN_Y_TOP, 250, STATUS_BAR_Y - TERRAIN_Y_TOP);

    ctx.strokeStyle = "white";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-200, DIVIDER_Y); ctx.lineTo(FINISH_X + 250, DIVIDER_Y);
    ctx.stroke();

    // 装飾
    ctx.font = "24px Arial";
    decors.forEach(d => ctx.fillText(d.icon, d.x, d.y));

    // ゴール線
    ctx.strokeStyle = "#FF4444";
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(FINISH_X, TERRAIN_Y_TOP + 30); ctx.lineTo(FINISH_X, STATUS_BAR_Y - 20); ctx.stroke();

    // モンスター
    ctx.font = "100px Arial";
    ctx.textAlign = "center";
    const bob1 = Math.sin(cur_pos1 * 0.05) * 10;
    const bob2 = Math.sin(cur_pos2 * 0.05) * 10;
    ctx.fillText(p1_team[p1_idx].icon, cur_pos1, 520 + bob1);
    ctx.fillText(p2_team[p2_idx].icon, cur_pos2, 320 + bob2);

    ctx.restore();

    // --- UI (非スクロール) ---
    drawHUD();
    
    if (countdownActive) {
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fillRect(0,0,WIN_W,WIN_H);
        ctx.fillStyle = "white";
        ctx.font = "bold 180px Arial";
        ctx.fillText(countdownValue > 0 ? countdownValue : "GO!", WIN_W/2, WIN_H/2);
    }
}

function drawHUD() {
    // ステータスバー背景
    ctx.fillStyle = "#F0F0F0";
    ctx.fillRect(0, STATUS_BAR_Y, WIN_W, WIN_H - STATUS_BAR_Y);

    // 進捗ミニマップ
    const mapX = 150, mapW = 980, mapY = 50, mapH = 30;
    terrain_configs.forEach((t, i) => {
        ctx.fillStyle = t.color;
        ctx.fillRect(mapX + (t.start / FINISH_X) * mapW, mapY, (2000 / FINISH_X) * mapW, mapH);
    });
    ctx.font = "24px Arial";
    ctx.fillText(p1_team[p1_idx].icon, mapX + (Math.max(0, Math.min(cur_pos1, FINISH_X)) / FINISH_X) * mapW, mapY + 45);
    ctx.fillText(p2_team[p2_idx].icon, mapX + (Math.max(0, Math.min(cur_pos2, FINISH_X)) / FINISH_X) * mapW, mapY + 20);

    // 1Pステータス
    drawPlayerStatus(1, 80, STATUS_BAR_Y + 22);
    // 2Pステータス
    drawPlayerStatus(2, 680, STATUS_BAR_Y + 22);
    
    // タイム
    ctx.fillStyle = "#333";
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "right";
    const elapsed = isRacing ? (Date.now() - startTime) / 1000 : 0;
    ctx.fillText(`Time: ${elapsed.toFixed(2)}s`, WIN_W - 20, 30);
}

function drawPlayerStatus(p, x, baseY) {
    const isP1 = p === 1;
    const team = isP1 ? p1_team : p2_team;
    const idx = isP1 ? p1_idx : p2_idx;
    const m = team[idx];
    const stamina = isP1 ? m1_stamina : m2_stamina;

    ctx.textAlign = "left";
    ctx.fillStyle = "#333";
    ctx.font = "bold 16px Arial";
    
    let currentY = baseY;
    ctx.fillText(`名前: ${m.name}${isP1 ? "" : " [CPU]"}`, x, currentY);
    currentY += 20; // 速度表示のためにY座標を下に移動
    ctx.fillText(`速度: ${m.min_spd} - ${m.max_spd}`, x, currentY);
    currentY += 20; // スタミナ表示のためにY座標を下に移動
    ctx.fillText(`${m.icon} スタミナ:`, x, currentY);

    // スタミナバー
    const barW = 300, barH = 20, barX = x + 120, barY = baseY + 25; // スタミナバーのY座標を調整
    ctx.fillStyle = "#555";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = isP1 ? "#4CAF50" : "#2196F3";
    ctx.fillRect(barX, barY, barW * (stamina / m.max_stamina), barH);
    ctx.fillStyle = "white";
    ctx.font = "14px Arial";
    ctx.fillText(`${stamina.toFixed(1)} / ${m.max_stamina}`, barX + 100, barY + 15);

    // チームアイコン
    team.forEach((tm, i) => {
        const iconX = x + 440 + i * 50; // 水平位置は変更なし
        const iconY = baseY + 20; // チームアイコンのY座標を少し上に調整
        ctx.textAlign = "center";
        ctx.font = "32px Arial";
        // クリック判定の中心(iconX + 10)に合わせて中央揃えで描画
        ctx.fillText(tm.icon, iconX + 10, iconY);
        if (i === idx) {
            ctx.strokeStyle = "#FF4500";
            ctx.lineWidth = 2;
            // クリック判定範囲(40x40)と一致させる
            ctx.strokeRect(iconX - 10, iconY - 30, 40, 40);
        }
        // 相性表示
        const curTerrain = terrain_configs.find(tc => (isP1 ? cur_pos1 : cur_pos2) >= tc.start && (isP1 ? cur_pos1 : cur_pos2) < tc.end);
        const aff = tm.affinities[curTerrain ? curTerrain.name : "草原"] || "○";
        ctx.textAlign = "center"; // アイコンに合わせて中央揃え
        ctx.font = "bold 20px Arial"; // フォントサイズを大きく
        ctx.fillStyle = "#FF4500";
        ctx.fillText(aff, iconX + 10, iconY + 30); // 相性表示も少し上に移動
    });
}

function drawResult() {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, WIN_W, WIN_H);
    ctx.textAlign = "center";

    let outcome = "DRAW";
    let color = "gray";
    if (p1_finish_time < p2_finish_time) { outcome = "1P WIN!!"; color = "#4CAF50"; }
    else if (p1_finish_time > p2_finish_time) { outcome = "1P LOSE..."; color = "#FF4444"; }

    ctx.fillStyle = color;
    ctx.font = "bold 100px Arial";
    ctx.fillText(outcome, WIN_W / 2, 200);

    ctx.fillStyle = "#333";
    ctx.font = "bold 50px Arial";
    const first = p1_finish_time < p2_finish_time ? { i: p1_team[p1_idx].icon, t: p1_finish_time } : { i: p2_team[p2_idx].icon, t: p2_finish_time };
    const second = p1_finish_time > p2_finish_time ? { i: p1_team[p1_idx].icon, t: p1_finish_time } : { i: p2_team[p2_idx].icon, t: p2_finish_time };

    ctx.fillText(`1st: ${first.i} ${first.t.toFixed(2)}s`, WIN_W / 2, 350);
    ctx.fillText(`2nd: ${second.i} ${second.t.toFixed(2)}s`, WIN_W / 2, 420);
    
    ctx.font = "24px Arial";
    ctx.fillText("CLICK TO RESTART", WIN_W / 2, 550);
}

// --- インタラクション ---
function handleCanvasClick(e) {
    const rect = canvas.getBoundingClientRect();
    // CSSでリサイズされた表示サイズと内部解像度の比率を計算して座標を変換
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (currentScene === "title") {
        currentScene = "select";
        selectedIndices = [];
    } else if (currentScene === "select") {
        MONSTER_POOL.forEach((m, i) => {
            const col = i % 3, row = Math.floor(i / 3);
            const mx = 340 + col * 300, my = 200 + row * 150;
            if (x > mx - 100 && x < mx + 100 && y > my - 70 && y < my + 60) {
                if (selectedIndices.includes(i)) {
                    selectedIndices = selectedIndices.filter(idx => idx !== i);
                } else if (selectedIndices.length < TEAM_SIZE) {
                    selectedIndices.push(i);
                    if (selectedIndices.length === TEAM_SIZE) {
                        setTimeout(() => {
                            currentScene = "race";
                            setupRace();
                        }, 500);
                    }
                }
            }
        });
    } else if (currentScene === "race") {
        // 1P チーム交代ボタン判定
        for (let i = 0; i < TEAM_SIZE; i++) {
            const btnX = 80 + 440 + i * 50;
            const btnY = (STATUS_BAR_Y + 22) + 20; // 描画位置(baseY + 25)と同期
            if (x > btnX - 10 && x < btnX + 30 && y > btnY - 30 && y < btnY + 10) {
                if (i !== p1_idx) swapMonster(1, i);
            }
        }
    } else if (currentScene === "result") {
        currentScene = "title";
    }
}

init();
