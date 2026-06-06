// === 全域變數宣告 ===
let bgMusic;            // 背景音樂變數
let cheerSound;         // 全破歡呼音效
let beepSound;          // 游標懸停/切換選項滴答音效
let confirmSound;       // 按下/確認選項音效
let prevMenuSelection = 0;  // 追蹤主選單切換，避免重複播放
let globalHoverState = "";  // 追蹤各畫面的按鈕懸停狀態
let hasCheered = false; // 紀錄是否已經播放過歡呼音效
let currentScene = -1;  // -1: 起始畫面, 0: 主選單, 1: 遊戲一, 2: 遊戲二, 3: 遊戲三
let mouseX_pos = 0;     // PoseNet 平滑後的 X (需在你的 PoseNet 邏輯中更新)
let mouseY_pos = 0;     // PoseNet 平滑後的 Y

// === 手勢辨識介接變數 ===
// 當你使用 ml5.handpose 時，請根據食指與拇指距離判斷
// 如果距離小於門檻，請將 isPinching 設為 true
let isPinching = false; 
let isPinchingPrev = false; // 用於偵測「剛捏合」的瞬間
let cursorTrail = []; // 儲存游標發光殘影軌跡
let cursorAnimSize = 24; // 新增：用於平滑縮放游標大小
let bgParticles = []; // 儲存背景飄動的電子粒子
let bgClouds = [];    // 儲存背景飄動的像素雲朵

// 新增：無敵過關密技手勢 (比讚)
let isThumbsUp = false;
let isThumbsUpPrev = false;
let cheatTimer = 0; // 用於控制「CHEAT ACTIVATED!」跑馬燈的計時器

// 新增：五指張開手勢與選單選擇
let isHandOpen = false; 
let isHandOpenPrev = false; // 用於偵測「剛張開」的瞬間
let menuSelection = 0;   // 0: 行為, 1: 認知, 2: 建構
let achievements = [false, false, false, false]; // 追蹤四個關卡的通關狀態 (闖關成就)
let bestTimes = [null, null, null, null]; // 追蹤四個關卡的最快通關時間

let confirmTimer = 0;    // 確認進度計時器
let confirmThreshold = 90; // 延長確認時間，需要張開手維持約 1.5 秒

// === 遊戲狀態與計時器 ===
let gameState = "playing"; // playing, win, lose, intro
let prevGameState = "playing"; // 新增：追蹤上一幀的狀態，用於觸發音量漸變
let countdown = 0;
let lastTimerTick = 0;

// === ml5.js 手勢辨識變數 ===
let handpose;
let predictions = [];
let modelLoaded = false; // 用於追蹤 AI 模型是否載入完成
let loadingBg; // 儲存載入畫面的背景圖
let bootBg; // 儲存起始畫面的背景圖
let loadingAlpha = 0; // 控制載入畫面的淡入淡出透明度
let loadingProgress = 0; // 模擬載入進度條

// 遊戲一：行為主義老鼠迷宮變數
let items = [];         // 儲存所有掉落物 (起司與電擊)
let floatingTexts = []; // 新增：儲存飄浮文字特效
let score = 0;          // 分數
let gameTimer = 0;      // 用於產生掉落物的計時器
let deadAnimTimer = 0;  // 紀錄老鼠死亡動畫的計時器
let winAnimTimer = 0;   // 紀錄過關動畫的計時器
let stampAnimTimer = 0; // 紀錄過關蓋章動畫的計時器

// 遊戲二：認知主義記憶翻牌變數
let video;              // 攝像頭影像
let cards = [];         // 儲存卡牌物件
let lockBoard = false;  // 防止在判定勝負時繼續翻牌
let matchCount = 0;     // 配對成功的次數
let matchTimer = 0;     // 配對失敗後的自動關牌計時器
let cardsToClose = [];  // 暫時儲存需要翻回去的卡牌
let mistakeCount = 0;   // 翻錯次數 (達 3 次則失敗)

// 遊戲三：建構主義積木搭建變數
let floatingBlocks = []; // 飄浮中的積木
let stackedBlocks = [];  // 已堆疊好的積木
let heldBlock = null;    // 目前手中抓著的積木
let buildTimer = 0;
let floorY = 0;          // 地板高度
let shakeTimer = 0;      // 震動計時器

function preload() {
  // 預先載入 1.png 圖片作為背景
  loadingBg = loadImage('1.png');
  // 預先載入 2.png 圖片作為起始畫面背景
  bootBg = loadImage('2.png');
  // 預先載入背景音樂
  bgMusic = loadSound('music.mp3');
  // 預先載入全破歡呼音效
  cheerSound = loadSound('cheer.mp3');
  // 預先載入選單與確認音效
  beepSound = loadSound('beep.mp3');
  confirmSound = loadSound('confirm.mp3');
}

function setup() {
  // 建立橫式全螢幕畫布
  createCanvas(windowWidth, windowHeight);
  
  // 設定並嘗試播放背景音樂
  bgMusic.setVolume(0.4); // 設定音量 (0.0 ~ 1.0)
  bgMusic.loop();         // 設定循環播放
  
  // 調整 UI 音效音量 (將懸停滴答聲調小，避免太吵)
  if (beepSound) beepSound.setVolume(0.15); 
  if (confirmSound) confirmSound.setVolume(0.4);

  // 嘗試從 sessionStorage 讀取進度 (為了從第四關返回時保留紀錄)
  let savedAchievements = sessionStorage.getItem('edu_achievements');
  if (savedAchievements) achievements = JSON.parse(savedAchievements);
  let savedBestTimes = sessionStorage.getItem('edu_bestTimes');
  if (savedBestTimes) bestTimes = JSON.parse(savedBestTimes);

  // 如果是從第四關回來，觸發第四關的通關蓋章動畫
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('from') === 'level4') {
    currentScene = 4; // 進入結算畫面
    gameState = "win";
    stampAnimTimer = 60; // 觸發蓋章動畫
    achievements[3] = true;
    sessionStorage.setItem('edu_achievements', JSON.stringify(achievements)); // 儲存進度
    try {
      window.history.replaceState({}, document.title, window.location.pathname); // 清除網址參數
    } catch (e) {
      console.warn("本地端執行時無法清除網址參數，已略過此步驟", e);
    }
  }

  // 初始化攝像頭
  let constraints = {
    video: {
      facingMode: "user" // 強制使用前置鏡頭 (自拍鏡頭)
    },
    audio: false
  };
  video = createCapture(constraints);
  video.size(320, 240); // 降低解析度以大幅提升手機 AI 辨識效能 (不影響畫面與映射)
  video.hide(); // 隱藏原生網頁標籤，只畫在 Canvas 內

  // 初始化 Handpose 模型 (ml5 v1.0+ 最新標準寫法，不傳入 video)
  handpose = ml5.handPose(() => {
    console.log("手勢辨識模型已就緒！");
    modelLoaded = true;

    // 模型載入完成後，才把 video 餵給 detectStart 開始持續辨識
    handpose.detectStart(video, results => {
      predictions = results;
    });
  });
}

// --- 核心：手勢辨識與數據更新 ---
function updateHandData() {
  if (modelLoaded && predictions.length > 0 && video.width > 0) {
    let hand = predictions[0]; // 最新版直接取得手部物件

    // 1. 更新座標：使用食指指尖 (點 8) 作為控制點，並進行鏡像與縮放映射
    // 最新版座標是物件格式 {x, y} 而非陣列 [x, y]
    let targetX = map(hand.keypoints[8].x, 0, video.width, width, 0);
    let targetY = map(hand.keypoints[8].y, 0, video.height, 0, height);
    
    // 防呆：避免 targetX/Y 在瞬間算出 NaN 導致游標永久當機消失
    if (!isNaN(targetX) && !isNaN(targetY)) {
      mouseX_pos = lerp(mouseX_pos || targetX, targetX, 0.3);
      mouseY_pos = lerp(mouseY_pos || targetY, targetY, 0.3);
    }

    // 2. 判定 Pinch (捏合)：計算食指尖 (8) 與拇指尖 (4) 的距離
    let pinchDist = dist(hand.keypoints[4].x, hand.keypoints[4].y, hand.keypoints[8].x, hand.keypoints[8].y);
    isPinching = pinchDist < 60; // 稍微放寬判定距離，更好捏合

    // 3. 判定五指張開 (Open Hand)：檢查食指、中指、無名指、小指尖端是否都遠離手腕
    let wrist = hand.keypoints[0];
    // 徹底優化：比較「指尖」與「指節」離手腕的相對距離，並加上門檻以降低誤觸率
    let openCount = 0;
    [8, 12, 16, 20].forEach(tipIdx => {
      let jointIdx = tipIdx - 2;
      let tipDist = dist(hand.keypoints[tipIdx].x, hand.keypoints[tipIdx].y, wrist.x, wrist.y);
      let jointDist = dist(hand.keypoints[jointIdx].x, hand.keypoints[jointIdx].y, wrist.x, wrist.y);
      if (tipDist > jointDist * 1.2) openCount++; // 提高伸直判定標準：指尖必須明顯比指節更遠
    });
    isHandOpen = openCount >= 4; // 必須 4 根手指都明確張開才判定為張開

    // --- 新增：判定比讚 (Thumbs Up) ---
    // 條件：四指皆彎曲 (openCount === 0) 且大拇指尖端 (4) 明顯高於食指根部 (5)
    let isThumbUpward = hand.keypoints[4].y < hand.keypoints[5].y - 20; 
    isThumbsUp = (openCount === 0) && isThumbUpward;
  } else {
    // 如果沒偵測到手，重置狀態
    isHandOpen = false;
    isPinching = false;
    isThumbsUp = false;
  }
}

function draw() {
  updateHandData(); // 每一影格更新手勢狀態

  // === 1. 復古霓虹背景（暗紫色調） ===
  // 讓背景顏色有微弱的呼吸變化
  let bgPulse = sin(frameCount * 0.02) * 5;
  background(20 + bgPulse, 15, 30 + bgPulse * 2);
  
  // 處理畫面震動效果
  push();
  if (shakeTimer > 0) {
    translate(random(-shakeTimer, shakeTimer), random(-shakeTimer, shakeTimer));
    shakeTimer--; // 震動隨時間遞減
  }

  // 繪製背景復古網格（Grid），營造 1980/1990 電子世界感
  stroke(40, 30, 60);
  strokeWeight(1);
  for (let x = 0; x < width; x += 40) {
    line(x, 0, x, height);
  }
  // 讓水平網格有向下移動的動態感 (合成波/Retro 視覺效果)
  let gridOffset = (frameCount * 0.8) % 40;
  for (let y = gridOffset; y < height; y += 40) {
    line(0, y, width, y);
  }

  // --- 新增：像素雲朵 (Pixel Clouds) ---
  // 每 150 個影格隨機生成一朵新的雲
  if (frameCount % 150 === 0) {
    bgClouds.push({
      x: width + 50,
      y: random(20, height * 0.4), // 集中在畫面上半部
      speed: random(0.2, 0.6),     // 非常緩慢地向左飄
      size: floor(random(3, 8))    // 隨機像素大小
    });
  }
  
  noStroke();
  for (let i = bgClouds.length - 1; i >= 0; i--) {
    let c = bgClouds[i];
    c.x -= c.speed; // 向左移動
    fill(255, 255, 255, 25); // 非常淡的半透明白色
    let s = c.size;
    // 繪製簡單的 8-bit 風格雲朵 (由三個長方形堆疊而成)
    rect(c.x + s * 2, c.y, s * 4, s);
    rect(c.x, c.y + s, s * 8, s);
    rect(c.x + s, c.y + s * 2, s * 6, s);
    
    if (c.x < -100) bgClouds.splice(i, 1); // 超出螢幕左側則刪除，釋放記憶體
  }

  // --- 新增：背景電子粒子 (Digital Dust) ---
  // 每 8 個影格隨機生成一顆新的粒子
  if (frameCount % 8 === 0) {
    bgParticles.push({
      x: random(width),
      y: height + 20, // 從畫面底部外面產生
      size: floor(random(3, 10)), // 隨機像素方塊大小
      speed: random(1, 2.5), // 往上升的速度
      drift: random(1000), // 賦予每個粒子不同的左右飄移頻率
      c: random(1) > 0.5 ? color(0, 200, 255) : color(255, 50, 150) // 隨機賦予水藍色或霓虹粉色
    });
  }
  
  noStroke();
  for (let i = bgParticles.length - 1; i >= 0; i--) {
    let p = bgParticles[i];
    p.y -= p.speed; // 向上飄動
    p.x += sin(frameCount * 0.02 + p.drift) * 0.5; // 加入微弱的 S 型左右飄擺
    fill(p.c.levels[0], p.c.levels[1], p.c.levels[2], 120); // 帶透明度發光
    rect(p.x, p.y, p.size, p.size, 1); // 畫出電子方塊
    if (p.y < -20) bgParticles.splice(i, 1); // 超出螢幕上方則刪除，釋放記憶體
  }

  // === 2. 掌上型電玩主機機身 ===
  let consoleW = width * 0.85;
  let consoleH = height * 0.85;
  let consoleX = (width - consoleW) / 2;
  let consoleY = (height - consoleH) / 2;

  // === 過關動畫：主機彩色光芒 (僅在 Scene 3 完成時觸發) ===
  if (currentScene === 3 && stackedBlocks.length >= 4) {
    push();
    colorMode(HSB, 360, 100, 100, 100); // 切換到 HSB 模式製作彩虹色
    let hueValue = (frameCount * 2) % 360; // 隨時間改變顏色
    let glowIntensity = 30 + sin(frameCount * 0.1) * 20; // 呼吸燈般的跳動感
    drawingContext.shadowBlur = glowIntensity; // 使用原生畫布 API 產生光暈
    drawingContext.shadowColor = color(hueValue, 80, 100).toString();
    fill(hueValue, 40, 100, 20); // 淡淡的背景色
    noStroke();
    rect(consoleX - 10, consoleY - 10, consoleW + 20, consoleH + 20, 30);
    pop();
  }

  // 確認是否達成大師成就 (四個關卡皆通過)
  let isMaster = achievements[0] && achievements[1] && achievements[2] && achievements[3];

  noStroke();
  if (isMaster) {
    push();
    colorMode(HSB, 360, 100, 100); // 切換到 HSB 模式製作彩虹色
    let hueValue = (frameCount * 2) % 360; // 隨時間改變顏色
    
    // 賦予大師專屬：閃耀彩虹霓虹外殼發光效果
    drawingContext.shadowBlur = 25 + sin(frameCount * 0.1) * 10;
    drawingContext.shadowColor = color(hueValue, 80, 100).toString();
    fill(hueValue, 30, 90); // 帶有霓虹感的彩虹基底色
    rect(consoleX, consoleY, consoleW, consoleH, 20);
    
    // 底部深色立體陰影 (無發光，顏色較深保持立體感)
    drawingContext.shadowBlur = 0;
    fill(hueValue, 50, 60);
    rect(consoleX, consoleY + consoleH - 15, consoleW, 15, 0, 0, 20, 20);
    pop();
  } else {
    // 預設主機灰色外殼
    fill(60, 65, 75); 
    rect(consoleX, consoleY, consoleW, consoleH, 20);

    // 主機外殼深色陰影（增加立體厚度感）
    fill(45, 50, 55);
    rect(consoleX, consoleY + consoleH - 15, consoleW, 15, 0, 0, 20, 20);
  }

  // === 3. 頂部：復古卡帶插槽 ===
  fill(30, 30, 35);
  rect(width / 2 - 180, consoleY + 15, 360, 20, 5);

  // --- 新增：頂部右側 手勢狀態小面板 ---
  push();
  let statusW = 100;
  let statusH = 24;
  let statusX = consoleX + consoleW - statusW - 20; // 靠右對齊
  let statusY = consoleY + 13;

  // 畫一個小小的電子螢幕邊框
  fill(15, 15, 20);
  stroke(40, 45, 55);
  strokeWeight(2);
  rect(statusX, statusY, statusW, statusH, 4);

  // 判斷當前手勢狀態與對應顏色
  let statusText = "❌ 未偵測";
  let statusColor = color(255, 50, 50); // 紅色警示
  if (!modelLoaded) {
    statusText = "⏳ 載入中";
    statusColor = color(150, 150, 150);
  } else if (predictions.length > 0) {
    if (isPinching) { statusText = "🤏 捏合中"; statusColor = color(255, 200, 0); }
    else if (isThumbsUp) { statusText = "👍 密技"; statusColor = color(255, 100, 200); }
    else if (isHandOpen) { statusText = "🖐 張開"; statusColor = color(0, 200, 255); }
    else { statusText = "✋ 追蹤中"; statusColor = color(0, 255, 100); }
  }

  noStroke();
  fill(statusColor);
  drawingContext.shadowBlur = 8; // 狀態文字發光特效
  drawingContext.shadowColor = statusColor.toString();
  textSize(12);
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  text(statusText, statusX + statusW / 2, statusY + statusH / 2 + 1); // +1 微調垂直置中
  pop();

  // === 4. 中央：復古遊戲螢幕外框 ===
  let screenW = consoleW * 0.65;
  let screenH = consoleH * 0.75;
  let screenX = consoleX + (consoleW * 0.05);
  let screenY = consoleY + (consoleH - screenH) / 2;

  // 螢幕深灰色邊框
  fill(35, 35, 40);
  rect(screenX, screenY, screenW, screenH, 10);

  // 邊框上的復古裝飾線
  stroke(220, 50, 50); // 紅線
  strokeWeight(3);
  line(screenX + 20, screenY + 15, screenX + screenW - 20, screenY + 15);
  stroke(50, 100, 200); // 藍線
  line(screenX + 20, screenY + 22, screenX + screenW - 20, screenY + 22);

  // --- 新增：機台指示燈與標籤 ---
  push();
  // 1. LED 數字時鐘 (取代原本的 POWER 指示燈)
  let h = nf(hour(), 2);
  let m = nf(minute(), 2);
  let s = nf(second(), 2);
  let colon = (frameCount % 60 < 30) ? ":" : " "; // 每半秒閃爍一次的冒號
  let timeStr = `${h}${colon}${m}${colon}${s}`;
  
  // 根據模型載入狀態決定時鐘顏色 (載入中紅色閃爍，完成後水藍色常亮)
  let clockColor = modelLoaded ? color(0, 200, 255) : color(255, 50, 50);
  if (!modelLoaded && frameCount % 30 < 15) clockColor = color(100, 20, 20); 
  
  fill(clockColor);
  drawingContext.shadowBlur = 10;
  drawingContext.shadowColor = clockColor.toString();
  textSize(16);
  textStyle(BOLD);
  textAlign(LEFT, CENTER);
  text("TIME " + timeStr, screenX + 20, screenY - 20);
  drawingContext.shadowBlur = 0; // 關閉發光效果避免影響後續繪圖

  // 2. 品牌或機台型號 Logo
  textAlign(RIGHT, CENTER);
  textStyle(ITALIC);
  textSize(16);
  fill(150, 150, 160);
  text("EduPsych Boy™", screenX + screenW - 20, screenY - 20);
  pop();

  // === 5. 真正的遊戲畫面渲染區（CRT 電視綠色感） ===
  noStroke();
  fill(10, 20, 30); // 暗藍色底色
  let playAreaX = screenX + 30;
  let playAreaY = screenY + 40;
  let playAreaW = screenW - 60;
  let playAreaH = screenH - 70;
  rect(playAreaX, playAreaY, playAreaW, playAreaH);

  // --- 修改：復古雜訊雪花畫面特效 (大幅降低迴圈次數優化效能) ---
  push();
  noStroke();
  for (let i = 0; i < 80; i++) {
    let noiseX = random(playAreaX, playAreaX + playAreaW - 4);
    let noiseY = random(playAreaY, playAreaY + playAreaH - 4);
    let noiseSize = random(3, 6); // 將雪花稍微放大，填補數量減少的空缺
    // 隨機產生半透明的黑色或白色雪花
    fill(random(1) > 0.5 ? 255 : 0, random(15, 30)); 
    rect(noiseX, noiseY, noiseSize, noiseSize);
  }
  pop();

  // === 8. 場景切換邏輯 ===
  // 根據 currentScene 決定要畫哪一個關卡
  switch (currentScene) {
    case -1:
      // 將起始畫面參數改為全畫布大小 (0, 0, width, height)
      drawBootScreen(0, 0, width, height);
      break;
    case 0:
      // 重置遊戲狀態
      gameState = "playing";
      
      // 選單互動邏輯：擴大感應區，並根據是否全破動態決定選項數量
      let menuY = constrain(mouseY_pos, height * 0.25, height * 0.75);
      let allClear = achievements[0] && achievements[1] && achievements[2] && achievements[3];
      let menuCount = allClear ? 5 : 4; // 如果全破會有 5 個選項，否則為 4 個
      menuSelection = floor(map(menuY, height * 0.25, height * 0.75, 0, menuCount));
      menuSelection = constrain(menuSelection, 0, menuCount - 1);

      // --- 新增：主選單選項切換音效 ---
      if (menuSelection !== prevMenuSelection) {
        if (beepSound && beepSound.isLoaded()) beepSound.play();
        prevMenuSelection = menuSelection;
      }

      // --- 優化：蓄力確認機制 (改為捏合) ---
      let isActionTriggered = (isPinching && modelLoaded && predictions.length > 0);
      if (isActionTriggered) {
        confirmTimer++;
        if (confirmTimer >= confirmThreshold) {
          if (confirmSound && confirmSound.isLoaded()) confirmSound.play(); // 播放確認音效
          handleMenuSelection(playAreaX, playAreaY, playAreaW, playAreaH);
          confirmTimer = 0; // 觸發後重置
        }
      } else {
        confirmTimer = Math.max(0, confirmTimer - 2); // 沒觸發時進度條快速退回
      }

      drawMenu(playAreaX, playAreaY, playAreaW, playAreaH);
      break;
    case 1:
      runGameOne(playAreaX, playAreaY, playAreaW, playAreaH);
      break;
    case 2:
      runGameTwo(playAreaX, playAreaY, playAreaW, playAreaH);
      break;
    case 3:
      runGameThree(playAreaX, playAreaY, playAreaW, playAreaH);
      break;
    case 4:
      // 為了顯示第四關蓋章動畫而建立的空場景
      drawEndScreen(playAreaX, playAreaY, playAreaW, playAreaH);
      break;
  }

  // === 9. CRT 螢幕玻璃反光與動態厚掃描線疊加 ===
  push();
  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.rect(playAreaX, playAreaY, playAreaW, playAreaH);
  drawingContext.clip(); // 限制特效只在螢幕範圍內渲染

  // 1. 緩慢向下移動的粗掃描線 (Roll bar)
  let barY = playAreaY + (frameCount * 1.5) % (playAreaH + 100) - 50;
  let gradient = drawingContext.createLinearGradient(0, barY, 0, barY + 50);
  gradient.addColorStop(0, "rgba(0, 200, 255, 0)");
  gradient.addColorStop(0.5, "rgba(0, 200, 255, 0.15)"); // 微弱的水藍色漸層
  gradient.addColorStop(1, "rgba(0, 200, 255, 0)");
  drawingContext.fillStyle = gradient;
  rect(playAreaX, barY, playAreaW, 50);

  // 2. 玻璃斜角反光 (Glare)
  fill(255, 255, 255, 12);
  noStroke();
  beginShape();
  vertex(playAreaX, playAreaY);
  vertex(playAreaX + playAreaW * 0.4, playAreaY);
  vertex(playAreaX, playAreaY + playAreaH * 0.7);
  endShape(CLOSE);

  drawingContext.restore();
  pop();

  // === 6. 右側：實體遊戲按鈕區 ===
  drawControls(screenX, screenW, screenY, screenH, consoleW);

  // --- 全域手部游標顯示 ---
  // 更新游標軌跡
  if (predictions.length > 0) {
    // 記錄當下的 x, y 與捏合狀態
    cursorTrail.push({ x: mouseX_pos, y: mouseY_pos, pinch: isPinching });
    if (cursorTrail.length > 20) {
      cursorTrail.shift(); // 維持最多 20 個殘影點
    }
  } else if (cursorTrail.length > 0) {
    cursorTrail.shift(); // 沒偵測到手時讓殘影慢慢消失
  }

  if (cursorTrail.length > 0 || predictions.length > 0) {
    push();
    
    // 1. 繪製發光殘影 (Trail) 特效
    drawingContext.shadowBlur = 10; // 讓殘影也有發光感
    noStroke();
    for (let i = 0; i < cursorTrail.length; i++) {
      let pt = cursorTrail[i];
      let progress = i / cursorTrail.length; // 越新的點數值越接近 1
      let size = progress * 15; // 越早的點越小 (尖端收尾)
      let alpha = progress * 150; // 越早的點越透明
      
      // 如果當時是捏合狀態，殘影也顯示紅色
      let c = pt.pinch ? color(255, 50, 50, alpha) : color(0, 200, 255, alpha);
      drawingContext.shadowColor = c.toString();
      fill(c);
      ellipse(pt.x, pt.y, size, size);
    }

    // 2. 繪製當前游標實體
    if (predictions.length > 0) {
      // 平滑計算游標大小 (類似 CSS transition)
      let targetSize = isPinching ? 14 : 24;
      cursorAnimSize = lerp(cursorAnimSize, targetSize, 0.3);
      
      // 科幻發光特效 (類似 CSS box-shadow)
      drawingContext.shadowBlur = isPinching ? 20 : 15;
      drawingContext.shadowColor = isPinching ? "rgba(255, 50, 50, 0.8)" : "rgba(0, 200, 255, 0.6)";
      
      fill(isPinching ? color(255, 50, 50, 200) : color(0, 200, 255, 100));
      stroke(isPinching ? color(255, 50, 50) : color(0, 200, 255));
      strokeWeight(2);
      ellipse(mouseX_pos, mouseY_pos, cursorAnimSize, cursorAnimSize);
      
      if (isPinching) {
        // 捏合時增加一個擴散的外環
        noFill();
        stroke(255, 50, 50, 150);
        strokeWeight(1);
        ellipse(mouseX_pos, mouseY_pos, cursorAnimSize * 2.5, cursorAnimSize * 2.5);
      }
    }
    pop();
  }

  isPinchingPrev = isPinching; // 紀錄這一影格的狀態供下一影格比較
  isHandOpenPrev = isHandOpen; // 紀錄這一影格的狀態供下一影格比較
  isThumbsUpPrev = isThumbsUp; // 紀錄這一影格的狀態供下一影格比較

  // --- 新增：AI 模型載入畫面 (淡入淡出過場特效) ---
  if (!modelLoaded) {
    loadingAlpha = min(loadingAlpha + 10, 255); // 模型未載入，增加透明度 (淡入)
    loadingProgress += (90 - loadingProgress) * 0.05; // 模擬載入進度最高到 90%
  } else {
    loadingAlpha = max(loadingAlpha - 10, 0);   // 模型已載入，減少透明度 (淡出)
    loadingProgress += (100 - loadingProgress) * 0.2; // 載入完成，瞬間跑到 100%
  }

  // 只要還沒完全透明，且不處於第四關結算畫面 (currentScene !== 4)，就持續在最上層繪製載入畫面
  // 這樣從第四關回來時，就能跳過黑色的載入畫面，直接看到獲勝結算！
  if (loadingAlpha > 0 && currentScene !== 4) {
    push();
    // 1. 新增純黑底色，完全遮擋底層的遊戲機畫面
    fill(0, loadingAlpha);
    noStroke();
    rect(0, 0, width, height);
    
    // 2. 繪製背景圖 (不再刻意降低透明度，直接跟隨 loadingAlpha 淡出)
    tint(255, loadingAlpha); 
    image(loadingBg, 0, 0, width, height); 
    
    // 3. 加上一層微微的深色遮罩，讓文字與進度條更清晰
    fill(10, 15, 25, map(loadingAlpha, 0, 255, 0, 180));
    noStroke();
    rect(0, 0, width, height);
    
    // 4. 精美文字設計 (霓虹發光效果)
    drawingContext.shadowBlur = 15;
    // 移除綠色，改用科技感的霓虹水藍色
    drawingContext.shadowColor = `rgba(0, 200, 255, ${loadingAlpha / 255})`;
    fill(255, 255, 255, loadingAlpha); // 標題改為乾淨的白色
    textSize(36); // 文字變大
    textStyle(BOLD);
    textAlign(CENTER, CENTER);
    text("AI 模型初始化中...", width / 2, height / 2 - 30); // 改為全中文
    
    drawingContext.shadowBlur = 0; // 關閉發光避免影響其他繪圖
    textSize(16);
    textStyle(NORMAL);
    fill(220, 240, 255, loadingAlpha); // 移除原本的微綠色調
    text("AI 手勢識別模組載入中，請保持雙手於畫面內", width / 2, height / 2 + 15);
    
    // 4. 科幻風動態進度條
    let barW = 350;
    let barH = 12;
    let barX = width / 2 - barW / 2;
    let barY = height / 2 + 50;
    
    stroke(0, 200, 255, loadingAlpha); // 外框也改為水藍色
    strokeWeight(2);
    noFill();
    rect(barX, barY, barW, barH, 6); // 進度條外框
    
    noStroke();
    // 替換為「一格一格」的格狀讀取效果
    let totalBlocks = 20; // 總格數
    let blockSpacing = 4; // 格子之間的間距
    let blockW = (barW - 4 - (totalBlocks - 1) * blockSpacing) / totalBlocks; // 計算單格寬度 (扣除外框厚度)
    let activeBlocks = floor(map(loadingProgress, 0, 100, 0, totalBlocks));
    
    for (let i = 0; i < totalBlocks; i++) {
      let bX = barX + 2 + i * (blockW + blockSpacing);
      let bY = barY + 2;
      fill(i < activeBlocks ? color(0, 200, 255, loadingAlpha) : color(50, 60, 80, loadingAlpha));
      rect(bX, bY, blockW, barH - 4, 2); // 繪製帶有圓角的獨立小方塊
    }
    
    // 百分比文字顯示
    fill(255, loadingAlpha);
    textSize(12);
    textAlign(RIGHT, CENTER);
    text(floor(loadingProgress) + "%", barX + barW, barY - 15);
    pop();
  }

  // --- 隱藏密技：CHEAT ACTIVATED 跑馬燈 ---
  if (cheatTimer > 0) {
    push();
    
    // --- 新增：雜訊 (Glitch) 視覺特效 ---
    for (let i = 0; i < 20; i++) {
      // 隨機產生彩色橫向撕裂方塊
      fill(random(255), random(255), random(255), random(100, 200));
      noStroke();
      rect(random(width), random(height), random(50, 300), random(2, 15));
    }
    // 隨機全螢幕閃爍 (模擬 RGB 色偏)
    if (frameCount % 4 < 2) {
      fill(255, 0, 0, 30); // 偏紅
    } else {
      fill(0, 200, 255, 30); // 偏水藍
    }
    rect(0, 0, width, height);

    let marqueeY = height / 2;
    // 讓 x 座標從右跑到左 (180 幀約 3 秒完成)
    let marqueeX = map(cheatTimer, 180, 0, width, -width * 2);
    
    // 半透明黑色警告條
    fill(0, 180);
    noStroke();
    rect(0, marqueeY - 50, width, 100);
    
    // 紅色發光文字
    drawingContext.shadowBlur = 20;
    drawingContext.shadowColor = "rgba(255, 50, 50, 1)";
    fill(255, 50, 50);
    textSize(50);
    textStyle(BOLD);
    textAlign(LEFT, CENTER);
    
    // 重複多次字串確保能長到填滿整個移動路徑
    let cheatText = "⚠ 作弊模式啟動！ ⚠   ".repeat(8);
    text(cheatText, marqueeX, marqueeY);
    
    drawingContext.shadowBlur = 0; // 重置發光效果，避免引發嚴重的效能崩潰 (當機)
    cheatTimer--;
    pop();
  }

  pop(); // 結束震動效果的作用範圍

  // --- 新增：背景音樂自動漸變邏輯 ---
  if (gameState === "paused" && prevGameState !== "paused") {
    if (bgMusic) bgMusic.setVolume(0.1, 0.5); // 進入暫停：0.5 秒內平滑降至 0.1 音量
  } else if (gameState !== "paused" && prevGameState === "paused") {
    if (bgMusic) bgMusic.setVolume(0.4, 0.5); // 解除暫停：0.5 秒內平滑恢復至預設 0.4 音量
  }
  prevGameState = gameState; // 紀錄當前狀態供下一影格比較
}

// --- 核心：更新倒數計時 ---
function updateCountdown() {
  if (gameState === "playing" && millis() - lastTimerTick >= 1000) {
    countdown--;
    lastTimerTick = millis();
    if (countdown <= 0) {
      countdown = 0;
      gameState = "lose_anim"; // 統一觸發失敗動畫
      deadAnimTimer = 60;      // 給予 1 秒動畫時間
    }
  }
}

// --- 核心：繪製關卡介紹畫面 ---
function drawIntroScreen(title, goal, control, theory, pX, pY, pW, pH) {
  push();
  
  // 定義不同關卡的專屬主題色
  let themeR = 0, themeG = 200, themeB = 255; // 預設水藍色
  let bgTop = "rgba(10, 15, 30, 0.85)", bgMid = "rgba(15, 25, 45, 0.9)", bgBot = "rgba(20, 40, 65, 0.95)";
  
  if (currentScene === 1) { // 行為主義：紅色調
    themeR = 255; themeG = 80; themeB = 80;
    bgTop = "rgba(30, 10, 10, 0.85)"; bgMid = "rgba(45, 15, 15, 0.9)"; bgBot = "rgba(65, 20, 20, 0.95)";
  } else if (currentScene === 2) { // 認知主義：紫色調
    themeR = 180; themeG = 80; themeB = 255;
    bgTop = "rgba(20, 10, 30, 0.85)"; bgMid = "rgba(30, 15, 45, 0.9)"; bgBot = "rgba(45, 20, 65, 0.95)";
  } else if (currentScene === 3) { // 建構主義：綠色調
    themeR = 80; themeG = 255; themeB = 150;
    bgTop = "rgba(10, 25, 15, 0.85)"; bgMid = "rgba(15, 40, 20, 0.9)"; bgBot = "rgba(20, 60, 30, 0.95)";
  }

  // 1. 繪製專屬主題色科技感漸層背景
  let bgGradient = drawingContext.createLinearGradient(pX, pY, pX, pY + pH);
  bgGradient.addColorStop(0, bgTop);
  bgGradient.addColorStop(0.5, bgMid);
  bgGradient.addColorStop(1, bgBot);
  drawingContext.fillStyle = bgGradient;
  noStroke();
  rect(pX, pY, pW, pH);

  // 2. 繪製動態復古網格 (Retro Grid)
  push();
  stroke(themeR, themeG, themeB, 25); // 使用專屬主題色的半透明網格
  strokeWeight(1);
  let gridSize = 30;
  let offset = (frameCount * 0.5) % gridSize; // 讓水平線緩慢向下移動
  for (let x = pX + gridSize / 2; x < pX + pW; x += gridSize) {
    line(x, pY, x, pY + pH);
  }
  for (let y = pY + offset; y < pY + pH; y += gridSize) {
    line(pX, y, pX + pW, y);
  }
  pop();

  // --- 新增：閃爍像素裝飾 ---
  // 1. 隨機像素點點，營造電子雜訊感
  for (let i = 0; i < 20; i++) {
    // 利用 frameCount 做簡單的頻率控制，讓點點看起來在閃動
    if (frameCount % 10 < 5) {
      fill(themeR, themeG, themeB, random(50, 150));
      rect(random(pX, pX + pW), random(pY, pY + pH), 4, 4);
    }
  }

  // 2. 復古電子感呼吸邊框 (利用 sin 讓透明度產生律動)
  stroke(themeR, themeG, themeB, 150 + sin(frameCount * 0.1) * 100);
  strokeWeight(2);
  noFill();
  rect(pX + 5, pY + 5, pW - 10, pH - 10, 2);
  noStroke();
  
  textAlign(CENTER, CENTER);
  fill(themeR, themeG, themeB);
  textSize(32); // 放大標題
  text(title, pX + pW / 2, pY + pH * 0.2);
  
  fill(255);
  textSize(18); // 放大目標與操作
  textStyle(BOLD);
  text("目標: " + goal, pX + pW / 2, pY + pH * 0.35);
  text("操作: " + control, pX + pW / 2, pY + pH * 0.42);
  
  textStyle(NORMAL);
  textSize(15); // 放大理論文字
  fill(200, 200, 255);
  textAlign(CENTER, TOP); // 修改：統一置中對齊，讓排版更和諧
  textLeading(26); // 加大行距，讓置中後的文字不擁擠
  text(theory, pX + 40, pY + pH * 0.50, pW - 80); // 移除高度限制，只給予寬度邊界自動換行，防止被裁切
  textAlign(CENTER, CENTER); // 恢復原本的置中對齊，以免影響後續的按鈕文字

  // --- 優化：提供「返回選單」與「開始挑戰」兩個按鈕 (手機版自動放大) ---
  let uiScale = width < 768 ? 1.3 : 1.0;
  let btnW = 140 * uiScale;
  let btnH = 45 * uiScale;
  let spacing = 20 * uiScale;
  let btnX1 = pX + pW / 2 - btnW - spacing / 2; // 左邊按鈕 (返回)
  let btnX2 = pX + pW / 2 + spacing / 2;        // 右邊按鈕 (開始)
  let btnY = pY + pH * 0.78;

  let hover1 = mouseX_pos > btnX1 && mouseX_pos < btnX1 + btnW && mouseY_pos > btnY && mouseY_pos < btnY + btnH;
  let hover2 = mouseX_pos > btnX2 && mouseX_pos < btnX2 + btnW && mouseY_pos > btnY && mouseY_pos < btnY + btnH;

  // --- 新增：按鈕懸停音效 ---
  let currentHover = hover1 ? "intro_btn1" : (hover2 ? "intro_btn2" : "");
  if (currentHover !== globalHoverState) {
    if (currentHover !== "" && beepSound && beepSound.isLoaded()) beepSound.play();
    globalHoverState = currentHover;
  }

  fill(255, 200, 0);
  textSize(14);
  text("💡 將游標移至按鈕並「捏合 (Pinch)」停留", pX + pW / 2, btnY - 20);

  let drawBtn = (x, y, w, h, label, isHovering) => {
    if (isHovering) {
      fill(themeR, themeG, themeB, map(sin(frameCount * 0.1), -1, 1, 100, 200));
      rect(x, y, w, h, 5);
              fill(0); textSize(16 * uiScale); text(label, x + w / 2, y + h / 2);
    } else {
      noFill(); stroke(themeR, themeG, themeB); strokeWeight(2);
      rect(x, y, w, h, 5);
              noStroke(); fill(themeR, themeG, themeB); textSize(16 * uiScale); text(label, x + w / 2, y + h / 2);
    }
  };

  drawBtn(btnX1, btnY, btnW, btnH, "返回選單", hover1);
  drawBtn(btnX2, btnY, btnW, btnH, "開始挑戰", hover2);

  if (hover1 || hover2) {
    let isActionTriggered = (isPinching && modelLoaded && predictions.length > 0);
    if (isActionTriggered) {
      confirmTimer++;
      fill(255, 255, 0);
      let barW = map(confirmTimer, 0, confirmThreshold, 0, btnW - 10);
      if (hover1) rect(btnX1 + 5, btnY + btnH - 10, barW, 6);
      if (hover2) rect(btnX2 + 5, btnY + btnH - 10, barW, 6);

      if (confirmTimer >= confirmThreshold) {
        if (confirmSound && confirmSound.isLoaded()) confirmSound.play(); // 播放確認音效
        if (hover1) {
          currentScene = 0; // 返回主選單
        }
        if (hover2) {
          gameState = "playing"; // 開始遊戲
          lastTimerTick = millis();
        }
        confirmTimer = 0; // 觸發後重置計時器
        isPinching = false; // 避免切換場景後誤觸
      }
    } else {
      confirmTimer = Math.max(0, confirmTimer - 2);
    }
  } else {
    confirmTimer = Math.max(0, confirmTimer - 2);
  }
  pop();
}

// --- 核心：繪製單一復古印章 ---
function drawStamp(x, y, label, scaleFactor, alpha) {
  push();
  translate(x, y);
  scale(scaleFactor);
  rotate(-0.15); // 稍微傾斜，看起來像手工蓋的印章
  
  stroke(220, 40, 40, alpha);
  strokeWeight(4);
  noFill();
  ellipse(0, 0, 60, 60);
  ellipse(0, 0, 50, 50);
  
  fill(220, 40, 40, alpha);
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(16);
  textStyle(BOLD);
  text(label, 0, 0);
  
  // 印章內的復古底線裝飾
  stroke(220, 40, 40, alpha);
  strokeWeight(2);
  line(-15, 12, 15, 12);
  pop();
}

// --- 核心：繪製結束畫面 ---
function drawEndScreen(pX, pY, pW, pH) {
  push();
  
  // 定義不同關卡的專屬主題色
  let themeR = 0, themeG = 200, themeB = 255; // 預設水藍色
  let bgTop = "rgba(10, 15, 30, 0.85)", bgMid = "rgba(15, 25, 45, 0.9)", bgBot = "rgba(20, 40, 65, 0.95)";
  
  if (currentScene === 1) { // 行為主義：紅色調
    themeR = 255; themeG = 80; themeB = 80;
    bgTop = "rgba(30, 10, 10, 0.85)"; bgMid = "rgba(45, 15, 15, 0.9)"; bgBot = "rgba(65, 20, 20, 0.95)";
  } else if (currentScene === 2) { // 認知主義：紫色調
    themeR = 180; themeG = 80; themeB = 255;
    bgTop = "rgba(20, 10, 30, 0.85)"; bgMid = "rgba(30, 15, 45, 0.9)"; bgBot = "rgba(45, 20, 65, 0.95)";
  } else if (currentScene === 3) { // 建構主義：綠色調
    themeR = 80; themeG = 255; themeB = 150;
    bgTop = "rgba(10, 25, 15, 0.85)"; bgMid = "rgba(15, 40, 20, 0.9)"; bgBot = "rgba(20, 60, 30, 0.95)";
  }

  // 1. 繪製專屬主題色科技感漸層背景
  let bgGradient = drawingContext.createLinearGradient(pX, pY, pX, pY + pH);
  bgGradient.addColorStop(0, bgTop);
  bgGradient.addColorStop(0.5, bgMid);
  bgGradient.addColorStop(1, bgBot);
  drawingContext.fillStyle = bgGradient;
  noStroke();
  rect(pX, pY, pW, pH);

  // 2. 繪製動態復古網格 (Retro Grid)
  push();
  stroke(themeR, themeG, themeB, 25); // 使用專屬主題色的半透明網格
  strokeWeight(1);
  let gridSize = 30;
  let offset = (frameCount * 0.5) % gridSize; // 讓水平線緩慢向下移動
  for (let x = pX + gridSize / 2; x < pX + pW; x += gridSize) {
    line(x, pY, x, pY + pH);
  }
  for (let y = pY + offset; y < pY + pH; y += gridSize) {
    line(pX, y, pX + pW, y);
  }
  pop();
  
  let allClear = achievements[0] && achievements[1] && achievements[2] && achievements[3];

  textAlign(CENTER, CENTER);
  if (gameState === "win") {
    if (stampAnimTimer > 0) stampAnimTimer--;

    // --- 繪製集章卡底板 ---
    fill(245, 240, 230); // 復古紙張顏色
    rect(pX + pW * 0.1, pY + pH * 0.2, pW * 0.8, pH * 0.45, 10);
    
    fill(40, 30, 20);
    textSize(24);
    text("- 學習集章卡 -", pX + pW / 2, pY + pH * 0.28);

    // 繪製四個集章格子
    let labels = ["行為制約", "訊息處理", "知識建構", "3D 互動"];
    for (let i = 0; i < 4; i++) {
      let slotX = pX + pW * 0.2 + i * (pW * 0.2);
      let slotY = pY + pH * 0.48;
      
      // 空的蓋章虛線框
      stroke(200, 180, 150);
      strokeWeight(2);
      drawingContext.setLineDash([5, 5]);
      noFill();
      ellipse(slotX, slotY, 60, 60);
      drawingContext.setLineDash([]); // 重置
      
      noStroke();
      fill(150, 130, 110);
      textSize(12);
      text(labels[i], slotX, slotY + 45);

      // --- 新增：顯示各關卡通關時間 ---
      if (achievements[i]) {
        fill(80, 140, 80); // 復古深綠色，搭配紙張底色
        if (bestTimes[i] !== null) {
          text(`🕒 ${bestTimes[i]} 秒`, slotX, slotY + 62);
        } else if (i === 3) {
          text(`🌟 探索完成`, slotX, slotY + 62); // 第四關為體驗性質，無計時
        }
      }

      // 動態蓋章特效邏輯
      if (achievements[i]) {
        // 如果是「這次」剛獲得的章，執行砸落動畫
        if (i === currentScene - 1 && stampAnimTimer > 0) {
          if (stampAnimTimer === 20) shakeTimer = 20; // 蓋下去的瞬間螢幕強烈震動
          if (stampAnimTimer > 20) {
            let s = map(stampAnimTimer, 60, 20, 4, 1); // 尺寸從巨大縮回正常
            let a = map(stampAnimTimer, 60, 20, 0, 255); // 透明度淡入
            drawStamp(slotX, slotY, "CLEAR", s, a);
          } else {
            drawStamp(slotX, slotY, "CLEAR", 1, 255);
          }
        } else {
          // 之前已經獲得的章，直接平靜地顯示
          drawStamp(slotX, slotY, "CLEAR", 1, 255);
        }
      }
    }

    // --- 標題文字與全破紙花特效 ---
    if (allClear && stampAnimTimer <= 0) {
      // 播放全破歡呼音效 (只播放一次)
      if (!hasCheered && cheerSound && cheerSound.isLoaded()) {
        cheerSound.play();
        hasCheered = true; // 確保只播放一次
      }

      drawingContext.shadowBlur = 20;
      drawingContext.shadowColor = "rgba(255, 200, 0, 1)";
      fill(255, 210, 0);
      textSize(36);
      text("🏆 教育心理學大師 通關！ 🏆", pX + pW / 2, pY + pH * 0.12);
      
      // --- 新增：計算並顯示總通關時間 ---
      let totalTime = 0;
      for (let t of bestTimes) {
        if (t !== null) totalTime += t;
      }
      
      drawingContext.shadowBlur = 10;
      drawingContext.shadowColor = "rgba(0, 200, 255, 1)";
      fill(200, 240, 255);
      textSize(18);
      text(`🎉 總共花費時間：${totalTime} 秒 🎉`, pX + pW / 2, pY + pH * 0.20);
      drawingContext.shadowBlur = 0;
      
      // 新增：全破提示文字 (取代原本的按鈕位置)
      fill(255, 200, 200);
      textSize(16);
      text("所有關卡已完成，感謝您的遊玩！", pX + pW / 2, pY + pH * 0.82);

      // 8-bit 風格瘋狂灑紙花
      for (let i = 0; i < 8; i++) {
        fill(random(100, 255), random(100, 255), random(100, 255));
        rect(pX + random(pW), pY + random(pH * 0.8), 8, 8);
      }
    } else {
      fill(themeR, themeG, themeB);
      textSize(32);
      text("關卡完成！獲得一枚印章", pX + pW / 2, pY + pH * 0.12);
    }

  } else {
    fill(255, 50, 50);
    textSize(40);
    text("挑戰失敗", pX + pW / 2, pY + pH / 2 - 20);
  }
  
  // --- 確認按鈕 (僅在動畫播完後出現) ---
  // 全破時隱藏按鈕，讓畫面永遠停留在獲勝結算卡上 (滿足「不要回起始頁」的需求)
  let isFinalWin = (gameState === "win" && allClear);
  if (gameState === "lose" || (gameState === "win" && stampAnimTimer <= 0 && !isFinalWin)) {
    let uiScale = width < 768 ? 1.3 : 1.0;
    let btnW = 160 * uiScale;
    let btnH = 45 * uiScale;
    let btnX = pX + (pW - btnW) / 2;
    let btnY = pY + pH * 0.75; // 下移避開集章卡

    let isHovering = mouseX_pos > btnX && mouseX_pos < btnX + btnW &&
                     mouseY_pos > btnY && mouseY_pos < btnY + btnH;

    // --- 新增：按鈕懸停音效 ---
    let currentHover = isHovering ? "end_btn" : "";
    if (currentHover !== globalHoverState) {
      if (currentHover !== "" && beepSound && beepSound.isLoaded()) beepSound.play();
      globalHoverState = currentHover;
    }

    fill(255, 200, 0);
    textSize(14);
    noStroke();
    text("💡 將游標移至按鈕並「捏合 (Pinch)」停留", pX + pW / 2, btnY - 20);

    if (isHovering) {
      fill(themeR, themeG, themeB, map(sin(frameCount * 0.1), -1, 1, 100, 200));
      rect(btnX, btnY, btnW, btnH, 5);
      fill(0);
      textSize(16 * uiScale);
      text("回主選單", pX + pW / 2, btnY + btnH / 2 + 1);

      let isActionTriggered = (isPinching && modelLoaded && predictions.length > 0);
      if (isActionTriggered) {
        confirmTimer++;
        fill(255, 255, 0);
        let barW = map(confirmTimer, 0, confirmThreshold, 0, btnW - 10);
        rect(btnX + 5, btnY + btnH - 10, barW, 6);
        if (confirmTimer >= confirmThreshold) {
          if (confirmSound && confirmSound.isLoaded()) confirmSound.play(); // 播放確認音效
          currentScene = 0;
          confirmTimer = 0;
        }
      } else {
        confirmTimer = Math.max(0, confirmTimer - 2);
      }
    } else {
      noFill();
      stroke(themeR, themeG, themeB);
      strokeWeight(2);
      rect(btnX, btnY, btnW, btnH, 5);
      noStroke();
      fill(themeR, themeG, themeB);
      textSize(16 * uiScale);
      text("回主選單", pX + pW / 2, btnY + btnH / 2 + 1);
      confirmTimer = Math.max(0, confirmTimer - 2);
    }
  }
  pop();
}

// --- 核心：繪製暫停畫面 ---
function drawPauseScreen(pX, pY, pW, pH) {
  push();
  
  // 定義不同關卡的專屬主題色
  let themeR = 0, themeG = 200, themeB = 255; // 預設水藍色
  let bgTop = "rgba(10, 15, 30, 0.85)", bgMid = "rgba(15, 25, 45, 0.9)", bgBot = "rgba(20, 40, 65, 0.95)";
  
  if (currentScene === 1) { // 行為主義：紅色調
    themeR = 255; themeG = 80; themeB = 80;
    bgTop = "rgba(30, 10, 10, 0.85)"; bgMid = "rgba(45, 15, 15, 0.9)"; bgBot = "rgba(65, 20, 20, 0.95)";
  } else if (currentScene === 2) { // 認知主義：紫色調
    themeR = 180; themeG = 80; themeB = 255;
    bgTop = "rgba(20, 10, 30, 0.85)"; bgMid = "rgba(30, 15, 45, 0.9)"; bgBot = "rgba(45, 20, 65, 0.95)";
  } else if (currentScene === 3) { // 建構主義：綠色調
    themeR = 80; themeG = 255; themeB = 150;
    bgTop = "rgba(10, 25, 15, 0.85)"; bgMid = "rgba(15, 40, 20, 0.9)"; bgBot = "rgba(20, 60, 30, 0.95)";
  }

  // 1. 繪製專屬主題色科技感漸層背景
  let bgGradient = drawingContext.createLinearGradient(pX, pY, pX, pY + pH);
  bgGradient.addColorStop(0, bgTop);
  bgGradient.addColorStop(0.5, bgMid);
  bgGradient.addColorStop(1, bgBot);
  drawingContext.fillStyle = bgGradient;
  noStroke();
  rect(pX, pY, pW, pH);

  // 2. 繪製動態復古網格 (Retro Grid)
  push();
  stroke(themeR, themeG, themeB, 25); // 使用專屬主題色的半透明網格
  strokeWeight(1);
  let gridSize = 30;
  let offset = (frameCount * 0.5) % gridSize; // 讓水平線緩慢向下移動
  for (let x = pX + gridSize / 2; x < pX + pW; x += gridSize) {
    line(x, pY, x, pY + pH);
  }
  for (let y = pY + offset; y < pY + pH; y += gridSize) {
    line(pX, y, pX + pW, y);
  }
  pop();

  textAlign(CENTER, CENTER);
  
  // 新增：暫停標題的呼吸發光特效
  drawingContext.shadowBlur = 20 + sin(frameCount * 0.1) * 15;
  drawingContext.shadowColor = `rgba(${themeR}, ${themeG}, ${themeB}, 1)`;
  fill(themeR, themeG, themeB);
  textSize(40);
  text("遊戲暫停", pX + pW / 2, pY + pH * 0.35);
  
  drawingContext.shadowBlur = 0; // 關閉發光效果，避免影響下方的按鈕繪製

  // 調整為三個按鈕的佈局 (手機版自動放大)
  let uiScale = width < 768 ? 1.2 : 1.0; // 三個按鈕比較擠，放大倍率稍微縮小一點
  let btnW = 130 * uiScale;
  let btnH = 45 * uiScale;
  let spacing = 15 * uiScale;
  let btnX2 = pX + pW / 2 - btnW / 2;        // 中間按鈕 (重新開始)
  let btnX1 = btnX2 - btnW - spacing;        // 左邊按鈕 (繼續遊戲)
  let btnX3 = btnX2 + btnW + spacing;        // 右邊按鈕 (回主選單)
  let btnY = pY + pH * 0.6;

  let hover1 = mouseX_pos > btnX1 && mouseX_pos < btnX1 + btnW && mouseY_pos > btnY && mouseY_pos < btnY + btnH;
  let hover2 = mouseX_pos > btnX2 && mouseX_pos < btnX2 + btnW && mouseY_pos > btnY && mouseY_pos < btnY + btnH;
  let hover3 = mouseX_pos > btnX3 && mouseX_pos < btnX3 + btnW && mouseY_pos > btnY && mouseY_pos < btnY + btnH;

  // --- 新增：按鈕懸停音效 ---
  let currentHover = hover1 ? "pause_btn1" : (hover2 ? "pause_btn2" : (hover3 ? "pause_btn3" : ""));
  if (currentHover !== globalHoverState) {
    if (currentHover !== "" && beepSound && beepSound.isLoaded()) beepSound.play();
    globalHoverState = currentHover;
  }

  fill(255, 200, 0);
  textSize(14);
  text("💡 將游標移至按鈕並「捏合 (Pinch)」停留", pX + pW / 2, btnY - 20);

  // 繪製三個按鈕
  let drawBtn = (x, y, w, h, label, isHovering) => {
    if (isHovering) {
      fill(themeR, themeG, themeB, map(sin(frameCount * 0.1), -1, 1, 100, 200));
      rect(x, y, w, h, 5);
      fill(0); textSize(15 * uiScale); text(label, x + w / 2, y + h / 2);
    } else {
      noFill(); stroke(themeR, themeG, themeB); strokeWeight(2);
      rect(x, y, w, h, 5);
      noStroke(); fill(themeR, themeG, themeB); textSize(15 * uiScale); text(label, x + w / 2, y + h / 2);
    }
  };
  drawBtn(btnX1, btnY, btnW, btnH, "繼續遊戲", hover1);
  drawBtn(btnX2, btnY, btnW, btnH, "重新開始", hover2);
  drawBtn(btnX3, btnY, btnW, btnH, "回主選單", hover3);

  // 進度條觸發邏輯
  if (hover1 || hover2 || hover3) {
    let isActionTriggered = (isPinching && modelLoaded && predictions.length > 0);
    if (isActionTriggered) {
      confirmTimer++;
      fill(255, 255, 0);
      let barW = map(confirmTimer, 0, confirmThreshold, 0, btnW - 10);
      if (hover1) rect(btnX1 + 5, btnY + btnH - 10, barW, 6);
      if (hover2) rect(btnX2 + 5, btnY + btnH - 10, barW, 6);
      if (hover3) rect(btnX3 + 5, btnY + btnH - 10, barW, 6);

      if (confirmTimer >= confirmThreshold) {
        if (confirmSound && confirmSound.isLoaded()) confirmSound.play(); // 播放確認音效
        if (hover1) { 
          gameState = "playing"; 
          lastTimerTick = millis(); 
        }
        if (hover2) { 
          // 根據 currentScene 判斷要重置哪一關
          if (currentScene === 1) {
            score = 0; items = []; countdown = 30; gameState = "intro"; deadAnimTimer = 0;
          } else if (currentScene === 2) {
            initGameTwo(pX, pY, pW, pH); countdown = 45; gameState = "intro";
          } else if (currentScene === 3) {
            initGameThree(pX, pY, pW, pH); countdown = 60; gameState = "intro"; winAnimTimer = 0;
          }
        }
        if (hover3) { 
          currentScene = 0; 
        }
        confirmTimer = 0;
        isPinching = false; // 避免切換場景後誤觸其他功能
      }
    } else {
      confirmTimer = Math.max(0, confirmTimer - 2);
    }
  } else {
    confirmTimer = Math.max(0, confirmTimer - 2);
  }
  pop();
}

// --- 遊戲一：物件導向類別 ---
class FallingItem {
  constructor(pX, pY, pW, pH) {
    this.pX = pX; this.pY = pY; this.pW = pW; this.pH = pH;
    this.x = random(pX + 30, pX + pW - 30); // 隨機 X，邊界往內縮一點避免大物件卡牆
    this.y = pY - 40;                       // 從螢幕上方外面開始掉 (配合放大拉高起始點)
    this.speed = random(4, 8);              // 加快隨機掉落速度，提升挑戰性
    this.size = 45;                         // 紀錄變大的尺寸
    // 50% 機率是起司，50% 是電擊
    this.type = random(1) > 0.5 ? "cheese" : "shock";
  }

  update() {
    this.y += this.speed; // 向下移動
  }

  display() {
    noStroke();
    if (this.type === "cheese") {
      fill(255, 200, 0); // 黃色起司
      triangle(this.x, this.y, this.x - 20, this.y + 35, this.x + 20, this.y + 35); // 放大三角形
      fill(150, 100, 0);
      ellipse(this.x, this.y + 20, 8, 8); // 放大的起司小孔
    } else {
      fill(0, 200, 255); // 藍色電擊棒
      rect(this.x - 10, this.y, 20, 45, 3); // 放大長方形並加上圓角
      stroke(255);
      strokeWeight(3);
      line(this.x - 12, this.y + 10, this.x + 12, this.y + 30); // 放大閃電特效
    }
  }

  // 檢查是否超出螢幕下緣
  isOffScreen() {
    return this.y > this.pY + this.pH;
  }
}

// --- 遊戲一：核心邏輯 Function ---
function runGameOne(pX, pY, pW, pH) {
  if (gameState === "intro") {
    let theoryText = "理論背景：斯金納的操作制約。\n行為是透過「正增強」（起司獎勵）與「懲罰」（電擊）來形塑的。\n當行為產生積極結果時，該行為在未來發生的機率就會增加。";
    drawIntroScreen("行為主義", 
                    "吃到起司獲得 100 分 (扣至 -50 則失敗)。", 
                    "移動手勢控制老鼠位置。", 
                    theoryText,
                    pX, pY, pW, pH);
    return;
  }

  // --- 新增：播放死亡動畫中 ---
  if (gameState === "lose_anim") {
    deadAnimTimer--;
    if (deadAnimTimer <= 0) {
      gameState = "lose"; // 動畫播完才切換到真正的失敗畫面
    }
  }

  // --- 新增：播放過關光柱動畫中防護 ---
  if (gameState === "win_anim") {
    winAnimTimer--;
    if (winAnimTimer <= 0) {
      gameState = "win";
    }
  }

  if (gameState !== "playing" && gameState !== "lose_anim" && gameState !== "win_anim" && gameState !== "paused" && gameState !== "cheat_anim") {
    drawEndScreen(pX, pY, pW, pH);
    return;
  }

  // --- 新增：手勢觸發暫停 ---
  if (gameState === "playing" && isHandOpen && !isHandOpenPrev) {
    gameState = "paused";
  }

  // --- 新增：隱藏密技 (比讚無敵過關) ---
  if (gameState === "playing" && isThumbsUp && !isThumbsUpPrev) {
    gameState = "cheat_anim";
    cheatTimer = 180; // 觸發跑馬燈與回溯動畫
    shakeTimer = 30;  // 觸發畫面震動
    // 物品快速反向飛回天上
    for (let i of items) i.speed = -abs(i.speed) * 3; 
  }

  if (gameState === "cheat_anim") {
    if (cheatTimer <= 0) {
      score = 100;
      gameState = "win";
      stampAnimTimer = 60; // 觸發蓋章動畫
      achievements[0] = true;
      let timeSpent = 30 - countdown;
      if (bestTimes[0] === null || timeSpent < bestTimes[0]) bestTimes[0] = timeSpent;
    }
  }

  updateCountdown();

  // A. 繪製視訊背景 (鏡像處理)
  push();
  translate(pX + pW, pY);
  scale(-1, 1);
  image(video, 0, 0, pW, pH);
  // 加上一層半透明深色遮罩，讓 8-bit 元件更清晰
  fill(20, 30, 40, 150);
  noStroke();
  rect(0, 0, pW, pH);
  pop();

  // A. 玩家 (老鼠) 邏輯
  // 使用 constrain 確保老鼠不會跑出綠色螢幕
  let playerX = constrain(mouseX_pos, pX + 15, pX + pW - 15);
  let playerY = constrain(mouseY_pos, pY + 15, pY + pH - 15);

  if (gameState === "cheat_anim") {
    // 老鼠被強制吸回畫面正中央，並產生雜訊抖動
    let progress = map(cheatTimer, 180, 0, 0, 1);
    playerX = lerp(playerX, pX + pW / 2, progress) + random(-10, 10);
    playerY = lerp(playerY, pY + pH / 2, progress) + random(-10, 10);
  }

  // 畫老鼠 (全新頂視角，更像老鼠的特徵)
  push();
  translate(playerX, playerY);
  
  // --- 新增：頭暈旋轉與發黑動畫特效 ---
  let isDead = (gameState === "lose_anim");
  if (isDead) {
    rotate(frameCount * 0.3); // 頭暈旋轉
    scale(map(deadAnimTimer, 60, 0, 1, 0.2)); // 伴隨縮小墜落
    
    // 畫頭暈小星星
    push();
    stroke(255, 255, 0);
    strokeWeight(2);
    noFill();
    let starY = -30 + sin(frameCount * 0.3) * 5;
    ellipse(-12, starY, 4, 4);
    ellipse(12, starY - 5, 4, 4);
    pop();
  }
  
  // 1. 老鼠尾巴
  noFill();
  stroke(isDead ? 50 : 150); // 死亡時發黑
  strokeWeight(3);
  bezier(0, 10, 15, 25, -15, 35, 5, 45); // 彎曲的長尾巴
  
  // 2. 老鼠耳朵
  noStroke();
  fill(isDead ? 40 : 180); // 死亡時發黑
  ellipse(-12, -5, 16, 16); // 左耳外框
  ellipse(12, -5, 16, 16);  // 右耳外框
  fill(isDead ? 80 : color(255, 150, 150)); // 內耳發黑
  ellipse(-12, -5, 8, 8);   // 左耳內耳
  ellipse(12, -5, 8, 8);    // 右耳內耳
  
  // 3. 老鼠身體與尖尖的臉
  fill(isDead ? 50 : 200); // 死亡時發黑
  ellipse(0, 0, 26, 35);     // 圓圓的身體
  triangle(-12, -5, 12, -5, 0, -22); // 尖尖的鼻子輪廓
  
  // 4. 眼睛
  if (isDead) {
    // 死亡時變成白色的 X 叉叉眼
    stroke(255);
    strokeWeight(2);
    line(-7, -14, -3, -10); line(-3, -14, -7, -10); // 左眼 X
    line(3, -14, 7, -10);   line(7, -14, 3, -10);   // 右眼 X
  } else {
    fill(0);
    ellipse(-5, -12, 4, 4); // 左眼
    ellipse(5, -12, 4, 4);  // 右眼
  }
  
  // 5. 鬍鬚
  stroke(isDead ? 100 : 200); // 死亡時發黑
  strokeWeight(1);
  line(-3, -18, -18, -22); // 左上鬍鬚
  line(-3, -16, -18, -16); // 左下鬍鬚
  line(3, -18, 18, -22);   // 右上鬍鬚
  line(3, -16, 18, -16);   // 右下鬍鬚
  
  // 6. 鼻子
  noStroke();
  fill(isDead ? 80 : color(255, 100, 100)); // 死亡時發黑
  ellipse(0, -22, 6, 6);  // 粉紅小鼻子
  pop();
  
  // B. 自動生成物件
  if (gameState === "playing") { // 確保動畫期間不會繼續掉積木
    gameTimer++;
    if (gameTimer % 25 === 0) { // 加快生成頻率 (原本為 45)
      items.push(new FallingItem(pX, pY, pW, pH));
    }
  }

  // C. 處理所有掉落物 (更新、顯示、碰撞)
  for (let i = items.length - 1; i >= 0; i--) {
    if (gameState === "playing" || gameState === "cheat_anim") { // 確保動畫期間物件凍結在空中，但作弊時反向飛
      items[i].update();
    }
    items[i].display();

    if (gameState === "playing") {
      // 基礎碰撞偵測 (配合放大，將判定距離從 30 增加到 45)
      let d = dist(playerX, playerY, items[i].x, items[i].y + 15); // 將判定中心下移到物件中心
      if (d < 45) {
        if (items[i].type === "cheese") {
          score += 10; 
          if (score >= 100 && gameState === "playing") {
            gameState = "win"; // 滿百分勝利
            stampAnimTimer = 60; // 觸發蓋章動畫
            achievements[0] = true; // 解鎖行為主義成就
            let timeSpent = 30 - countdown; // 計算花費時間
            if (bestTimes[0] === null || timeSpent < bestTimes[0]) bestTimes[0] = timeSpent;
          }
          // 水藍色閃爍效果
          push();
          fill(0, 200, 255, 100);
          rect(pX, pY, pW, pH);
          pop();
          // 飄出 +10 特效
          floatingTexts.push({ x: items[i].x, y: items[i].y, text: "+10", alpha: 255, c: color(255, 200, 0) });
        } else {
          score -= 20; // 懲罰：削弱行為
          if (score <= -50) {
            gameState = "lose_anim"; // 觸發死亡動畫
            deadAnimTimer = 60;      // 設定動畫時間約 1 秒 (60 幀)
          }
          shakeTimer = 15; // 觸發畫面震動回饋
          // 紅色閃爍效果
          push();
          fill(255, 0, 0, 100);
          rect(pX, pY, pW, pH);
          pop();
          // 飄出 -20 特效
          floatingTexts.push({ x: items[i].x, y: items[i].y, text: "-20", alpha: 255, c: color(255, 100, 100) });
        }
        items.splice(i, 1); // 碰到後消失
      } 
      else if (items[i].isOffScreen()) {
        items.splice(i, 1); // 掉出螢幕後消失
      }
    }
  }

  // --- 新增：繪製飄浮文字特效 ---
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    let ft = floatingTexts[i];
    if (gameState === "playing" || gameState === "cheat_anim") {
      ft.y -= 2; // 向上飄
      ft.alpha -= 5; // 逐漸透明
    }
    push();
    fill(ft.c.levels[0], ft.c.levels[1], ft.c.levels[2], ft.alpha);
    textSize(24);
    textStyle(BOLD);
    textAlign(CENTER, CENTER);
    text(ft.text, ft.x, ft.y);
    pop();
    
    if (ft.alpha <= 0) {
      floatingTexts.splice(i, 1);
    }
  }

  // D. 顯示分數與標題
  fill(0, 200, 255);
  textSize(14);
  textAlign(LEFT, TOP);
  text("獎勵積分: " + score, pX + 10, pY + 10);
  textAlign(CENTER, TOP);
  text("行為主義：獲得 100 分 (低於 -50 失敗)", pX + pW/2, pY + 10);

  // 顯示計時器
  textAlign(RIGHT, TOP);
  if (countdown <= 10 && countdown > 0) {
    fill(255, 50, 50, map(sin(frameCount * 0.5), -1, 1, 100, 255)); // 倒數 10 秒紅色閃爍警報
  } else {
    fill(255, 200, 0); // 正常黃色
  }
  text("⏳ 時間: " + countdown, pX + pW - 10, pY + 10);

  // 新增：時間進度條
  let barW = 80;
  let barH = 8;
  let barX = pX + pW - 10 - barW; // 對齊文字右邊
  let barY = pY + 10 + 14 + 5; // 在文字下方 + 文字大小 + 額外間距
  let maxTime = 30; // 遊戲一總時長

  // 進度條顏色與閃爍
  let barColor = color(0, 200, 255); // 預設水藍色
  if (countdown <= 10 && countdown > 0) {
    barColor = color(255, 50, 50, map(sin(frameCount * 0.5), -1, 1, 100, 255)); // 紅色閃爍
  }

  stroke(barColor);
  strokeWeight(1);
  noFill();
  rect(barX, barY, barW, barH, 2); // 進度條外框
  fill(barColor);
  rect(barX + 1, barY + 1, map(countdown, 0, maxTime, 0, barW - 2), barH - 2); // 進度條填充
  textAlign(CENTER, BOTTOM);
  textSize(10);
  text("起司 = +10 | 電擊 = -20", pX + pW/2, pY + pH - 10);

  textAlign(LEFT, BOTTOM);
  fill(255, 200, 0);
  textSize(12);
  text("🖐 張開五指可暫停", pX + 10, pY + pH - 10);

  if (gameState === "paused") {
    drawPauseScreen(pX, pY, pW, pH);
  }
}

// --- 遊戲二：物件導向類別 (認知卡片) ---
class MemoryCard {
  constructor(x, y, w, h, type) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.type = type; // 0: 圓形, 1: 正方形, 2: 三角形
    this.flipped = false;
    this.matched = false;
    this.scaleX = 1.0; // 用於翻轉動畫的水平縮放值 (1 為背面, -1 為正面)
    this.matchAnimTimer = 0; // 配對成功動畫計時器
    this.vx = 0; // 用於失敗掉落動畫的 X 速度
    this.vy = 0; // 用於失敗掉落動畫的 Y 速度
    this.rot = 0; // 用於失敗掉落動畫的旋轉角度
    this.rotSpeed = 0; // 旋轉速度
  }

  display() {
    // 如果已配對且動畫結束，則不再繪製
    if (this.matched && this.matchAnimTimer <= 0) return; 

    // 處理翻轉動畫邏輯：朝目標縮放值前進
    let targetScale = this.flipped ? -1.0 : 1.0;
    this.scaleX = lerp(this.scaleX, targetScale, 0.2);

    push();

    // --- 新增：計算翻轉進度 (0.0 為平放，1.0 為邊緣朝向鏡頭) ---
    let flipProgress = 1.0 - abs(this.scaleX);
    let offsetY = 0;

    if (this.matchAnimTimer > 0) {
      // 彈跳效果：使用 sin 函數產生拋物線跳動感
      offsetY = -sin(map(this.matchAnimTimer, 40, 0, 0, PI)) * 40;
      this.matchAnimTimer--; // 更新計時器
    }

    // 將座標系統移到卡片中心點，方便進行中心縮放
    translate(this.x + this.w / 2, this.y + this.h / 2 + offsetY);
    
    rotate(this.rot); // 加上旋轉 (用於失敗掉落動畫)

    // --- 優化：模擬 3D 透視放大 ---
    // 當卡片轉向側面時，同時稍微放大，產生往鏡頭靠近的 3D 錯覺
    let popScale = 1.0 + flipProgress * 0.15; // 最高放大 15%
    scale(abs(this.scaleX) * popScale, popScale); 

    // --- 效能優化：徹底移除 shadowBlur，改用疊加透明矩形繪製立體陰影 ---
    noStroke();
    if (this.matchAnimTimer > 0) {
      // 配對成功時的發光效果
      for (let i = 3; i > 0; i--) {
        fill(0, 200, 255, 30);
        rect(-this.w / 2 - i * 4, -this.h / 2 - i * 4, this.w + i * 8, this.h + i * 8, 5 + i * 2);
      }
    } else {
      // 翻轉時的立體陰影
      let shadowOffset = 5 + flipProgress * 12;
      let shadowSpread = 10 + flipProgress * 10;
      fill(0, 0, 0, 40);
      rect(-this.w / 2 - shadowSpread * 0.5, -this.h / 2 + shadowOffset - shadowSpread * 0.5, this.w + shadowSpread, this.h + shadowSpread, 10);
    }

    stroke(0, 200, 255);
    strokeWeight(2);
    
    if (this.scaleX < 0) { // 當縮放值過中點，顯示正面
      fill(255); // 正面：白色底
      rect(-this.w / 2, -this.h / 2, this.w, this.h, 5);
      noStroke();
      fill(50, 50, 200);
      if (this.type === 0) ellipse(0, 0, this.w * 0.6);
      else if (this.type === 1) rect(-this.w * 0.3, -this.h * 0.3, this.w * 0.6, this.h * 0.6);
      else if (this.type === 2) triangle(0, -this.h * 0.3, -this.w * 0.3, this.h * 0.3, this.w * 0.3, this.h * 0.3);
    } else {
      fill(20, 30, 40); // 背面：深色
      rect(-this.w / 2, -this.h / 2, this.w, this.h, 5);
      
      // --- 新增：牌背復古幾何裝飾 (動態霓虹閃爍) ---
      push();
      noFill();
      
      // 利用 frameCount 與卡片座標產生交錯的閃爍頻率
      let pulse1 = sin(frameCount * 0.1 + this.x * 0.05); 
      let pulse2 = cos(frameCount * 0.15 + this.y * 0.05);

      // --- 效能優化：移除牌背內裝飾的高耗能陰影特效，改用透明度變化 ---
      // 1. 霓虹水藍色內框
      stroke(0, 200, 255, 150 + pulse1 * 80); 
      strokeWeight(2);
      rect(-this.w * 0.4, -this.h * 0.4, this.w * 0.8, this.h * 0.8, 3);
      
      // 2. 霓虹粉紅色圓形與對角線交叉
      stroke(255, 50, 150, 150 + pulse2 * 80);
      strokeWeight(1.5);
      ellipse(0, 0, this.w * 0.6, this.w * 0.6);
      line(-this.w * 0.4, -this.h * 0.4, this.w * 0.4, this.h * 0.4);
      line(this.w * 0.4, -this.h * 0.4, -this.w * 0.4, this.h * 0.4);

      // 3. 中心懸浮的問號
      noStroke();
      fill(150, 255, 200, 200 + sin(frameCount * 0.2) * 55);
      textAlign(CENTER, CENTER);
      textSize(24 + sin(frameCount * 0.15) * 2); // 微微放大縮小呼吸
      text("?", 0, 0);

      pop();
    }
    pop();
  }

  update(px, py) {
    // 將圓形判定改為矩形判定 (Bounding Box)，並加上容錯範圍，讓手指更好觸發
    let margin = 15;
    if (px > this.x - margin && px < this.x + this.w + margin && 
        py > this.y - margin && py < this.y + this.h + margin) {
      // 優化：改為「觸發式」翻牌 (Pinch Trigger)
      // 只有在這一影格剛捏合，且上一影格沒捏合時才觸發
      let actionTrigger = (isPinching && !isPinchingPrev);
      if (!this.flipped && !this.matched && !lockBoard && actionTrigger) {
        this.flipped = true;
        return true; 
      }
    }
    return false;
  }
}

// --- 遊戲二：核心邏輯 Function ---
function runGameTwo(pX, pY, pW, pH) {
  if (gameState === "intro") {
    let theoryText = "理論背景：訊息處理論。\n學習涉及訊息的編碼、儲存與檢索。\n配對相同卡片的過程模擬了大腦如何辨識特徵，\n並將短期記憶中的資訊與長期記憶中的既有架構進行聯結。";
    drawIntroScreen("認知主義", 
                    "配對所有卡片以完成資訊編碼 (翻錯 3 次失敗)。", 
                    "保持捏合手勢並「滑過」卡片即可翻開。", 
                    theoryText,
                    pX, pY, pW, pH);
    return;
  }

  // --- 新增：播放失敗爆裂動畫中 ---
  if (gameState === "lose_anim") {
    deadAnimTimer--;
    
    // 觸發瞬間：賦予所有卡牌隨機爆發力與震動
    if (deadAnimTimer === 59) {
      shakeTimer = 30; // 畫面強烈震盪
      for (let c of cards) {
        c.vx = random(-15, 15);
        c.vy = random(-20, -5); // 向上炸開拋起
        c.rotSpeed = random(-0.3, 0.3); // 旋轉亂飛
      }
    }
    
    // 更新卡牌物理位置 (天女散花掉落)
    for (let c of cards) {
      c.x += c.vx;
      c.y += c.vy;
      c.vy += 1.5; // 重力加速度往下墜
      c.rot += c.rotSpeed;
    }

    if (deadAnimTimer <= 0) {
      gameState = "lose"; // 動畫結束，進入結算畫面
    }
  }

  if (gameState !== "playing" && gameState !== "lose_anim" && gameState !== "paused" && gameState !== "cheat_anim") {
    drawEndScreen(pX, pY, pW, pH);
    return;
  }

  // --- 新增：手勢觸發暫停 ---
  if (gameState === "playing" && isHandOpen && !isHandOpenPrev) {
    gameState = "paused";
  }

  // --- 新增：隱藏密技 (比讚無敵過關) ---
  if (gameState === "playing" && isThumbsUp && !isThumbsUpPrev) {
    gameState = "cheat_anim";
    cheatTimer = 180; // 觸發跑馬燈與回溯
    shakeTimer = 30;  // 觸發畫面震動
    // 卡牌進入回溯旋轉狀態
    for (let c of cards) {
      c.flipped = false;
      c.matched = false;
      c.rotSpeed = random(-0.3, 0.3);
    }
  }

  if (gameState === "cheat_anim") {
    for (let c of cards) {
      c.rot += c.rotSpeed; // 瘋狂旋轉
      c.x += random(-3, 3); // 雜訊抖動
      c.y += random(-3, 3);
    }
    if (cheatTimer <= 0) {
      matchCount = 3;
      for (let c of cards) {
        c.flipped = true;
        c.matched = true;
        c.rot = 0;
      }
      gameState = "win";
      stampAnimTimer = 60; // 觸發蓋章動畫
      achievements[1] = true;
      let timeSpent = 45 - countdown;
      if (bestTimes[1] === null || timeSpent < bestTimes[1]) bestTimes[1] = timeSpent;
    }
  }

  updateCountdown();

  // A. 繪製視訊背景 (鏡像處理，更直覺)
  push();
  translate(pX + pW, pY);
  scale(-1, 1);
  image(video, 0, 0, pW, pH);
  pop();

  // 失敗時的紅色閃爍特效
  if (gameState === "lose_anim" && deadAnimTimer > 40) {
    fill(255, 0, 0, map(deadAnimTimer, 60, 40, 200, 0));
    noStroke();
    rect(pX, pY, pW, pH);
  }

  // C. 處理所有卡牌
  for (let i = 0; i < cards.length; i++) {
    cards[i].display();
    if (gameState === "playing") { // 確保暫停時無法翻牌
      if (cards[i].update(mouseX_pos, mouseY_pos)) {
        checkMatching();
      }
    }
  }

  // D. 處理配對失敗的自動關牌 (計時器)
  if (gameState === "playing" && cardsToClose.length > 0) {
    matchTimer++;
    if (matchTimer > 60) { // 顯示 1 秒後關掉
      for (let c of cardsToClose) c.flipped = false;
      cardsToClose = [];
      matchTimer = 0;
      lockBoard = false;
    }
  }

  // E. 介面文字
  fill(0, 200, 255);
  textSize(14);
  textAlign(CENTER, TOP);
  text("認知主義：完成所有配對 (保持捏合手勢並滑過卡片)", pX + pW/2, pY + 10);

  // 顯示計時器
  textAlign(RIGHT, TOP);
  if (countdown <= 10 && countdown > 0) {
    fill(255, 50, 50, map(sin(frameCount * 0.5), -1, 1, 100, 255)); // 倒數 10 秒紅色閃爍警報
  } else {
    fill(255, 200, 0); // 正常黃色
  }
  text("⏳ 時間: " + countdown, pX + pW - 10, pY + 10);

  // 新增：時間進度條
  let barW = 80;
  let barH = 8;
  let barX = pX + pW - 10 - barW; // 對齊文字右邊
  let barY = pY + 10 + 14 + 5; // 在文字下方 + 文字大小 + 額外間距
  let maxTime = 45; // 遊戲二總時長

  // 進度條顏色與閃爍
  let barColor = color(0, 200, 255); // 預設水藍色
  if (countdown <= 10 && countdown > 0) {
    barColor = color(255, 50, 50, map(sin(frameCount * 0.5), -1, 1, 100, 255)); // 紅色閃爍
  }

  stroke(barColor);
  strokeWeight(1);
  noFill();
  rect(barX, barY, barW, barH, 2); // 進度條外框
  fill(barColor);
  rect(barX + 1, barY + 1, map(countdown, 0, maxTime, 0, barW - 2), barH - 2); // 進度條填充

  // 顯示失誤次數
  if (mistakeCount > 0) {
    fill(255, 50, 50);
    text("失誤: " + mistakeCount + " / 3", pX + pW - 10, pY + 30);
  }

  textAlign(LEFT, BOTTOM);
  fill(255, 200, 0);
  textSize(12);
  text("🖐 張開五指可暫停", pX + 10, pY + pH - 10);

  // --- 新增：配對進度條 ---
  let progressW = pW * 0.6;
  let progressH = 12;
  let progressX = pX + (pW - progressW) / 2;
  let progressY = pY + pH - 45;

  // 進度條外框
  stroke(0, 200, 255);
  strokeWeight(1);
  noFill();
  rect(progressX, progressY, progressW, progressH, 6);

  // 填充進度 (根據 matchCount，總共需配對 3 對)
  let fillW = map(matchCount, 0, 3, 0, progressW);
  noStroke();
  fill(0, 200, 255, 200);
  rect(progressX, progressY, fillW, progressH, 6);

  // 百分比文字
  fill(0, 200, 255);
  textSize(10);
  textAlign(CENTER, BOTTOM);
  let percent = floor((matchCount / 3) * 100);
  text("資訊編碼進度: " + percent + "%", pX + pW / 2, progressY - 5);

  if (matchCount === 3 && gameState === "playing") {
    gameState = "win";
    stampAnimTimer = 60; // 觸發蓋章動畫
    achievements[1] = true; // 解鎖認知主義成就
    let timeSpent = 45 - countdown; // 計算花費時間
    if (bestTimes[1] === null || timeSpent < bestTimes[1]) bestTimes[1] = timeSpent;
  }

  if (gameState === "paused") {
    drawPauseScreen(pX, pY, pW, pH);
  }
}

function checkMatching() {
  let flipped = [];
  for (let c of cards) {
    if (c.flipped && !c.matched) flipped.push(c);
  }

  if (flipped.length >= 2) {
    if (flipped[0].type === flipped[1].type) {
      flipped[0].matched = true;
      flipped[1].matched = true;
      // 觸發配對成功的動畫計時器 (約 0.6 秒)
      flipped[0].matchAnimTimer = 40;
      flipped[1].matchAnimTimer = 40;
      matchCount++;
    } else {
      // 配對失敗
      mistakeCount++;
      if (mistakeCount >= 3) {
        gameState = "lose_anim"; // 觸發炸裂失敗動畫
        deadAnimTimer = 60;
      } else {
        lockBoard = true;
        cardsToClose = [flipped[0], flipped[1]];
        matchTimer = 0; // 確保計時器從 0 開始
      }
    }
  }
}

function initGameTwo(pX, pY, pW, pH) {
  cards = [];
  let cW = pW * 0.2;
  let cH = pH * 0.3;
  let types = [0, 0, 1, 1, 2, 2];
  // 隨機打亂
  for (let i = types.length - 1; i > 0; i--) {
    let j = floor(random(i + 1));
    let temp = types[i];
    types[i] = types[j];
    types[j] = temp;
  }
  for (let i = 0; i < 6; i++) {
    let col = i % 3;
    let row = floor(i / 3);
    cards.push(new MemoryCard(pX + pW*0.1 + col*pW*0.3, pY + pH*0.15 + row*pH*0.4, cW, cH, types[i]));
  }
  matchCount = 0;
  mistakeCount = 0;  // 重置失誤次數
  lockBoard = false;
  cardsToClose = []; // 初始化時清空待關閉清單
  matchTimer = 0;    // 初始化時重置計時器
}

// --- 遊戲三：物件導向類別 (建構積木) ---
class ConstructBlock {
  constructor(pX, pY, pW, pH, label) {
    this.pX = pX; this.pY = pY; this.pW = pW; this.pH = pH;
    this.w = 100; // 放大積木寬度
    this.h = 40;  // 放大積木高度
    this.x = random(pX, pX + pW - this.w);
    this.y = random(pY, pY + pH / 2);
    this.label = label;
    this.col = color(random(100, 255), random(100, 255), random(100, 255));
    this.vx = random(-2.5, 2.5); // 加快飄動速度，增加抓取挑戰性
    this.vy = random(-2.5, 2.5);
    
    this.rot = 0;      // 新增：用於失敗崩塌動畫的旋轉角度
    this.rotSpeed = 0; // 新增：用於失敗崩塌動畫的旋轉速度

    // 新增：物理運動屬性
    this.isFalling = false;
    this.velocityY = 0;
    this.gravity = 0.8; // 重力加速度
    this.restitution = -0.4; // 彈跳係數 (每次反彈保留 40% 速度)
    this.targetY = 0;   // 目標落點
  }

  update() {
    if (this.isFalling) {
      // 重力加速度動畫邏輯
      this.velocityY += this.gravity;
      this.y += this.velocityY;

      // 檢查是否到達落點
      if (this.y >= this.targetY && this.velocityY > 0) {
        // 如果速度還夠快，就執行物理反彈
        if (this.velocityY > 2.0) {
          this.y = this.targetY;
          this.velocityY *= this.restitution;
        } else {
          // 能量耗盡，速度太小，正式停下
          this.y = this.targetY;
          this.isFalling = false;
          this.velocityY = 0;
          return true; // 代表已完全穩定並成功著陸
        }
      }
      return false;
    }

    // 讓積木在螢幕上半部輕微飄動 (Scaffolding 概念)
    this.x += this.vx;
    this.y += this.vy;

    // 邊界反彈
    if (this.x < this.pX || this.x > this.pX + this.pW - this.w) this.vx *= -1;
    if (this.y < this.pY || this.y > this.pY + this.pH / 2) this.vy *= -1;
    return false;
  }

  display() {
    push();
    translate(this.x + this.w / 2, this.y + this.h / 2); // 移至中心點
    rotate(this.rot); // 支援旋轉動畫
    fill(this.col);
    stroke(255);
    strokeWeight(1);
    rect(-this.w / 2, -this.h / 2, this.w, this.h, 3); // 原點改在中心
    fill(0);
    noStroke();
    textSize(12); // 配合積木放大文字
    textAlign(CENTER, CENTER);
    text(this.label, 0, 0);
    pop();
  }
}

// --- 遊戲三：核心邏輯 Function ---
function runGameThree(pX, pY, pW, pH) {
  if (gameState === "intro") {
    let theoryText = "理論背景：社會建構主義。\n知識並非被動接收，而是由學習者主動建構的。\n透過親手捕捉與堆疊「經驗」與「反思」等積木，\n學習者正在將新資訊整合進自我的認知結構中。";
    drawIntroScreen("建構主義", 
                    "搭建一座 4 層高的知識塔。", 
                    "捏合抓取，放開後堆疊。", 
                    theoryText,
                    pX, pY, pW, pH);
    return;
  }

  // --- 新增：播放失敗動畫中防護 (時間歸零時) ---
  if (gameState === "lose_anim") {
    deadAnimTimer--;
    
    // 觸發瞬間：賦予所有積木隨機爆發力與震動
    if (deadAnimTimer === 59) {
      shakeTimer = 30; // 畫面強烈震盪
      let allBlocks = [...stackedBlocks, ...floatingBlocks];
      if (heldBlock) allBlocks.push(heldBlock);
      
      for (let b of allBlocks) {
        b.vx = random(-15, 15);
        b.vy = random(-20, -5); // 向上炸開拋起
        b.rotSpeed = random(-0.3, 0.3); // 旋轉亂飛
      }
    }
    
    // 更新積木崩塌物理
    let allBlocks = [...stackedBlocks, ...floatingBlocks];
    if (heldBlock) allBlocks.push(heldBlock);
    
    for (let b of allBlocks) {
      b.x += b.vx;
      b.y += b.vy;
      b.vy += 1.5; // 重力加速度往下墜
      b.rot += b.rotSpeed;
    }

    if (deadAnimTimer <= 0) {
      gameState = "lose";
    }
  }

  // --- 新增：播放過關光柱動畫中防護與集章 ---
  if (gameState === "win_anim") {
    winAnimTimer--;
    if (winAnimTimer <= 0) {
      gameState = "win";
      stampAnimTimer = 60; // 觸發蓋章動畫
    }
  }

  if (gameState !== "playing" && gameState !== "lose_anim" && gameState !== "win_anim" && gameState !== "paused" && gameState !== "cheat_anim") {
    drawEndScreen(pX, pY, pW, pH);
    return;
  }

  // --- 新增：手勢觸發暫停 ---
  if (gameState === "playing" && isHandOpen && !isHandOpenPrev) {
    gameState = "paused";
  }

  // --- 新增：隱藏密技 (比讚無敵過關) ---
  if (gameState === "playing" && isThumbsUp && !isThumbsUpPrev) {
    gameState = "cheat_anim";
    cheatTimer = 180; // 觸發跑馬燈與回溯
    shakeTimer = 30;  // 觸發畫面震動
    // 所有積木強制解體往上飛散
    let allBlocks = [...stackedBlocks, ...floatingBlocks];
    if (heldBlock) { allBlocks.push(heldBlock); heldBlock = null; }
    stackedBlocks = [];
    floatingBlocks = allBlocks;
    for (let b of floatingBlocks) {
      b.isFalling = false;
      b.vx = random(-8, 8);
      b.vy = random(-15, -5);
      b.rotSpeed = random(-0.2, 0.2);
    }
  }

  if (gameState === "cheat_anim") {
    if (cheatTimer <= 0) {
      floatingBlocks = [];
      stackedBlocks = [];
      // 瞬間補齊積木，準備播放光柱過關動畫
      while (stackedBlocks.length < 4) {
        let b = new ConstructBlock(pX, pY, pW, pH, "CHEAT");
        b.x = pX + pW / 2 - b.w / 2;
        b.y = (pY + pH - 20) - (stackedBlocks.length + 1) * b.h;
        b.rot = 0;
        stackedBlocks.push(b);
      }
      gameState = "win_anim";
      winAnimTimer = 90;
      achievements[2] = true;
      let timeSpent = 60 - countdown;
      if (bestTimes[2] === null || timeSpent < bestTimes[2]) {
        bestTimes[2] = timeSpent;
        isNewRecord = true;
      } else {
        isNewRecord = false;
      }
    }
  }

  updateCountdown();

  // A. 繪製視訊背景 (鏡像處理)
  push();
  translate(pX + pW, pY);
  scale(-1, 1);
  image(video, 0, 0, pW, pH);
  pop();

  // 獨立背景：藍曬圖 (Blueprint) 深藍色
  push();
  fill(10, 30, 70, 220);
  noStroke();
  rect(pX, pY, pW, pH);
  stroke(255, 255, 255, 30);
  strokeWeight(1);
  for (let i = pX; i < pX + pW; i += 40) line(i, pY, i, pY + pH);
  for (let j = pY; j < pY + pH; j += 40) line(pX, j, pX + pW, j);
  pop();

  // 失敗時的紅色閃爍特效
  if (gameState === "lose_anim" && deadAnimTimer > 40) {
    fill(255, 0, 0, map(deadAnimTimer, 60, 40, 200, 0));
    noStroke();
    rect(pX, pY, pW, pH);
  }

  // B. 繪製地基
  fill(40, 50, 60);
  rect(pX + pW*0.2, pY + pH - 20, pW*0.6, 20);

  // C. 處理飄浮積木
  for (let i = floatingBlocks.length - 1; i >= 0; i--) {
    if (gameState === "playing") {
      floatingBlocks[i].update();
    } else if (gameState === "cheat_anim") {
      // 作弊回溯動畫：積木反重力向上飛散並旋轉
      floatingBlocks[i].x += floatingBlocks[i].vx;
      floatingBlocks[i].y += floatingBlocks[i].vy;
      floatingBlocks[i].rot += floatingBlocks[i].rotSpeed;
    }
    floatingBlocks[i].display();

    if (gameState === "playing") {
      // 建構主義核心：手部捏合(Pinching)才能抓起積木
      let isActionPressed = isPinching;
      if (heldBlock === null && isActionPressed) {
        let d = dist(mouseX_pos, mouseY_pos, floatingBlocks[i].x + 50, floatingBlocks[i].y + 20); // 配合放大調整判定中心
        if (d < 55) { // 放大抓取範圍
          heldBlock = floatingBlocks[i];
          floatingBlocks.splice(i, 1);
        }
      }
    }
  }

  // D. 處理手中抓著的積木
  if (heldBlock !== null) {
    if (gameState === "playing") {
      if (heldBlock.isFalling) {
        // 更新掉落動畫
        if (heldBlock.update()) {
          // 新增：檢查是否成功疊在下方積木或地基上 (重心判定)
          let supportX = stackedBlocks.length > 0 ? stackedBlocks[stackedBlocks.length - 1].x : (pX + pW * 0.2);
          let supportW = stackedBlocks.length > 0 ? stackedBlocks[stackedBlocks.length - 1].w : (pW * 0.6);
          let blockCenter = heldBlock.x + heldBlock.w / 2;
          
          // 如果積木的中心點落在支撐物範圍內，則判定堆疊成功
          if (blockCenter > supportX && blockCenter < supportX + supportW) {
            stackedBlocks.push(heldBlock); 
            shakeTimer = 10; // 成功落地震動回饋
          } else {
            // 判定失敗：積木掉出範圍，彈飛並重新變回飄浮積木
            heldBlock.isFalling = false;
            heldBlock.vx = random(-4, 4);
            heldBlock.vy = random(-6, -3); // 向上彈飛
            floatingBlocks.push(heldBlock);
            shakeTimer = 20; // 失敗強烈震動
          }
          heldBlock = null;
        } else {
          heldBlock.display();
        }
      } else {
        // 被抓取中
        // --- 新增：明確標示積木的降落目標區 (Drop Zone) ---
        let supportX = stackedBlocks.length > 0 ? stackedBlocks[stackedBlocks.length - 1].x : (pX + pW * 0.2);
        let supportW = stackedBlocks.length > 0 ? stackedBlocks[stackedBlocks.length - 1].w : (pW * 0.6);
        let targetY = (pY + pH - 20) - (stackedBlocks.length + 1) * heldBlock.h;

        push();
        // 繪製科技感發光虛線框
        stroke(0, 255, 100, 150 + sin(frameCount * 0.2) * 100); 
        strokeWeight(2);
        drawingContext.setLineDash([8, 6]); 
        fill(0, 255, 100, 30); 
        rect(supportX, targetY, supportW, heldBlock.h, 5);
        
        // 繪製明確的文字箭頭指引
        noStroke();
        fill(0, 255, 100, 200 + sin(frameCount * 0.2) * 55);
        textSize(16);
        textStyle(BOLD);
        textAlign(CENTER, BOTTOM);
        text("▼ 放置於此處 ▼", supportX + supportW / 2, targetY - 8);
        drawingContext.setLineDash([]); // 重置虛線避免影響其他繪圖
        pop();

        heldBlock.x = mouseX_pos - 50; // 配合放大調整抓取點
        heldBlock.y = mouseY_pos - 20;
        heldBlock.display();
        

        let isActionPressed = isPinching;
        // 只有放開捏合手勢 (!isPinching) 積木就會落下 (移除高度限制，允許高空投擲)
        if (!isActionPressed) {
          heldBlock.isFalling = true;
          heldBlock.velocityY = 0;
          // 動態計算目標落點 Y (地基高度 - 已堆疊積木總高度)
          heldBlock.targetY = (pY + pH - 20) - (stackedBlocks.length + 1) * heldBlock.h;
        }
      }
    } else {
      heldBlock.display(); // 動畫播放時僅顯示，物理狀態會由上方統一控制
    }
  }

  // E. 繪製已堆疊的積木
  for (let b of stackedBlocks) {
    b.display();
  }

  // --- 新增：金色光柱過關特效 ---
  if (gameState === "win_anim") {
    push();
    let isMobile = width < 768;
    let maxBeamH = pH;
    // 動畫：高度隨時間從 0 成長到 maxBeamH (約 0.75 秒升到頂)
    let currentBeamH = map(winAnimTimer, 90, 45, 0, maxBeamH);
    currentBeamH = constrain(currentBeamH, 0, maxBeamH);
    
    let beamX = pX + pW * 0.2;
    let beamW = pW * 0.6;
    let beamY = (pY + pH - 20) - currentBeamH; // 由下往上畫
    
    // 外層金色光芒 (帶有脈衝閃爍感)
    let beamAlpha = 150 + sin(frameCount * 0.2) * 50;
    noStroke();
    if (!isMobile) {
      // 效能優化寫法：疊加金光取代 shadowBlur
      for (let i = 3; i > 0; i--) {
        fill(255, 215, 0, beamAlpha * 0.15);
        let spread = i * 8;
        rect(beamX - spread, beamY, beamW + spread * 2, currentBeamH, 5 + spread);
      }
    }
    fill(255, 215, 0, beamAlpha); 
    rect(beamX, beamY, beamW, currentBeamH, 5); 
    
    // 內層高光白柱
    if (!isMobile) {
      fill(255, 255, 220, 40);
      rect(beamX + beamW * 0.1, beamY, beamW * 0.8, currentBeamH, 5 + 4);
    }
    fill(255, 255, 220, 200);
    rect(beamX + beamW * 0.2, beamY, beamW * 0.6, currentBeamH, 5);
    
    // 飄升的光輝粒子
    for (let i = 0; i < 5; i++) {
      fill(255, 255, 0, random(100, 255));
      let particleX = random(beamX, beamX + beamW);
      let particleY = random(beamY, pY + pH - 20); // 確保粒子只在光柱範圍內
      ellipse(particleX, particleY, random(3, 8));
    }
    pop();
  }

  // F. 介面文字
  fill(0, 200, 255);
  textSize(24);
  textAlign(CENTER, TOP);
  text("建構主義：堆疊 4 個知識積木", pX + pW/2, pY + 20);

  // 顯示計時器
  textAlign(RIGHT, TOP);
  if (countdown <= 10 && countdown > 0) {
    fill(255, 50, 50, map(sin(frameCount * 0.5), -1, 1, 100, 255)); // 倒數 10 秒紅色閃爍警報
  } else {
    fill(255, 200, 0); // 正常黃色
  }
  text("⏳ 時間: " + countdown, pX + pW - 20, pY + 20);

  // 新增：時間進度條
  let barW = 100;
  let barH = 8;
  let barX = pX + pW - 20 - barW; // 對齊文字右邊
  let barY = pY + 20 + 24 + 5; // 在文字下方 + 文字大小 + 額外間距
  let maxTime = 60; // 遊戲三總時長

  // 進度條顏色與閃爍
  let barColor = color(0, 200, 255); // 預設水藍色
  if (countdown <= 10 && countdown > 0) {
    barColor = color(255, 50, 50, map(sin(frameCount * 0.5), -1, 1, 100, 255)); // 紅色閃爍
  }

  stroke(barColor);
  strokeWeight(1);
  noFill();
  rect(barX, barY, barW, barH, 2); // 進度條外框
  fill(barColor);
  rect(barX + 1, barY + 1, map(countdown, 0, maxTime, 0, barW - 2), barH - 2); // 進度條填充
  
  textAlign(LEFT, BOTTOM);
  fill(255, 200, 0);
  textSize(12);
  text("🖐 張開五指可暫停", pX + 10, pY + pH - 10);

  if (stackedBlocks.length >= 4 && gameState === "playing") {
    gameState = "win_anim";
    winAnimTimer = 90; // 設定 1.5 秒光柱升起動畫
    achievements[2] = true; // 解鎖建構主義成就
    let timeSpent = 60 - countdown; // 計算花費時間
    if (bestTimes[2] === null || timeSpent < bestTimes[2]) {
      bestTimes[2] = timeSpent;
      isNewRecord = true;
    } else {
      isNewRecord = false;
    }
  }

  if (gameState === "paused") {
    drawPauseScreen(pX, pY, pW, pH);
  }
}

function initGameThree(pX, pY, pW, pH) {
  floatingBlocks = [];
  stackedBlocks = [];
  heldBlock = null;
  let concepts = ["具體經驗", "反思觀察", "抽象概念", "主動實驗"];
  for (let i = 0; i < concepts.length; i++) {
    floatingBlocks.push(new ConstructBlock(pX, pY, pW, pH, concepts[i]));
  }
}

// --- 新增：處理選單選擇進入關卡的邏輯 ---
function handleMenuSelection(pX, pY, pW, pH) {
  if (menuSelection === 0) {
    currentScene = 1;
    score = 0;
    items = [];
    floatingTexts = []; // 清空飄浮文字
    countdown = 30; // 行為主義給 30 秒
    gameState = "intro";
    deadAnimTimer = 0; // 重置死亡動畫計時器
  } else if (menuSelection === 1) {
    currentScene = 2;
    initGameTwo(pX, pY, pW, pH);
    countdown = 45; // 認知主義給 45 秒
    gameState = "intro";
  } else if (menuSelection === 2) {
    currentScene = 3;
    initGameThree(pX, pY, pW, pH);
    countdown = 60; // 建構主義給 60 秒
    gameState = "intro";
    winAnimTimer = 0; // 重置光柱動畫計時器
  } else if (menuSelection === 3) {
    // 將目前進度存入 sessionStorage，避免跳轉後遺失
    sessionStorage.setItem('edu_achievements', JSON.stringify(achievements));
    sessionStorage.setItem('edu_bestTimes', JSON.stringify(bestTimes));

    // 跳轉到第四關的獨立 Three.js 網頁
    window.location.href = "level4.html";
  } else if (menuSelection === 4) {
    // 重置遊戲進度 (隱藏按鈕功能)
    achievements = [false, false, false, false];
    bestTimes = [null, null, null, null];
    sessionStorage.removeItem('edu_achievements');
    sessionStorage.removeItem('edu_bestTimes');
    currentScene = -1; // 踢回最一開始的起點畫面
    menuSelection = 0;
    shakeTimer = 20; // 震動畫面給予清除紀錄的回饋
    hasCheered = false; // 重置歡呼狀態
  }
  // 重置狀態，避免連續觸發
  isPinching = false;
}

// --- 新增：起始情境畫面 (Boot Screen - 機台螢幕內) ---
function drawBootScreen(pX, pY, pW, pH) {
  // 封面不需要攝影機，只保留呼吸感遮罩與手部游標
  push();
  image(bootBg, pX, pY, pW, pH); // 顯示 2.png 背景
  fill(20, 15, 30, 210 + sin(frameCount * 0.05) * 40); // 加深遮罩透明度，讓文字更清晰
  rect(pX, pY, pW, pH);
  pop();

  // --- 新增：視差 (Parallax) 3D 透視特效 ---
  let offsetX = constrain(map(mouseX_pos, pX, pX + pW, -20, 20), -20, 20);
  let offsetY = constrain(map(mouseY_pos, pY, pY + pH, -20, 20), -20, 20);

  // 未偵測到手部的提示
  if (modelLoaded && predictions.length === 0) {
    fill(255, 50, 50);
    textSize(20); // 稍微放大
    textAlign(CENTER, TOP);
    text("尚未偵測到手部，請將手移入畫面", pX + pW/2, pY + 40);
  }

  push();
  // --- UI 最上層：標題 (位移最大) ---
  push();
  translate(offsetX * 1.5, offsetY * 1.5);
  textAlign(CENTER, CENTER);
  fill(0, 200, 255);
  textSize(60); // 放大全螢幕標題
  text("教育心理學博物館", pX + pW / 2, pY + pH * 0.35);
  pop();
  
  // --- UI 中層：內文說明 (基準位移) ---
  push();
  translate(offsetX * 1.0, offsetY * 1.0);
  textAlign(CENTER, CENTER);
  fill(200, 200, 255);
  textSize(24); // 放大內文說明
  text("歡迎來到復古教育機台！\n\n在這裡，我們將透過三個經典的互動小遊戲\n帶您親身體驗 行為主義、認知主義 與 建構主義。", pX + pW / 2, pY + pH * 0.55);
  pop();

  // --- UI 底層：進入按鈕與說明 (位移最小，並同步修改碰撞判定區域) 手機自適應 ---
  let uiScale = width < 768 ? 1.3 : 1.0;
  let btnW = 240 * uiScale;
  let btnH = 60 * uiScale;
  let btnX = pX + (pW - btnW) / 2 + offsetX * 0.5;
  let btnY = pY + pH * 0.75 + offsetY * 0.5;
  let isHovering = mouseX_pos > btnX && mouseX_pos < btnX + btnW && mouseY_pos > btnY && mouseY_pos < btnY + btnH;

  // --- 新增：按鈕懸停音效 ---
  let currentHover = isHovering ? "boot_btn" : "";
  if (currentHover !== globalHoverState) {
    if (currentHover !== "" && beepSound && beepSound.isLoaded()) beepSound.play();
    globalHoverState = currentHover;
  }

  textAlign(CENTER, CENTER);
  fill(255, 200, 0);
  textSize(18);
  text("💡 將游標移至按鈕並「捏合 (Pinch)」停留", btnX + btnW / 2, btnY - 20);

  if (isHovering) {
    fill(0, 200, 255, map(sin(frameCount * 0.1), -1, 1, 100, 200));
    rect(btnX, btnY, btnW, btnH, 10);
    fill(0);
    textSize(24 * uiScale);
    text("進入機台", btnX + btnW / 2, btnY + btnH / 2 + 2);

    let isActionTriggered = (isPinching && predictions.length > 0);
    if (isActionTriggered) {
      confirmTimer++;
      fill(255, 255, 0);
      let barW = map(confirmTimer, 0, confirmThreshold, 0, btnW - 10);
      rect(btnX + 5, btnY + btnH - 10, barW, 6);
      if (confirmTimer >= confirmThreshold) {
        if (confirmSound && confirmSound.isLoaded()) confirmSound.play(); // 播放確認音效
        currentScene = 0;
        confirmTimer = 0;
      }
    } else {
      confirmTimer = Math.max(0, confirmTimer - 2);
    }
  } else {
    noFill();
    stroke(0, 200, 255);
    strokeWeight(2);
    rect(btnX, btnY, btnW, btnH, 10);
    noStroke();
    fill(0, 200, 255);
    textSize(24 * uiScale);
    text("進入機台", btnX + btnW / 2, btnY + btnH / 2 + 2);
    confirmTimer = Math.max(0, confirmTimer - 2);
  }
  pop();
}

// --- 分離出來的繪圖輔助 Function (保持 draw 乾淨) ---
function drawMenu(pX, pY, pW, pH) {
  // 繪製視訊背景 (鏡像處理)
  push();
  translate(pX + pW, pY);
  scale(-1, 1);
  image(video, 0, 0, pW, pH);
  // 加上一層半透明黑色，讓文字更清楚
  // 加入呼吸感遮罩，讓畫面有螢幕閃爍感
  fill(0, 180 + sin(frameCount * 0.05) * 30);
  rect(0, 0, pW, pH);
  pop();

  // --- 新增：視差 (Parallax) 3D 透視特效 ---
  // 根據手部游標相對於螢幕中心的位置，計算出位移量
  let offsetX = constrain(map(mouseX_pos, pX, pX + pW, -20, 20), -20, 20);
  let offsetY = constrain(map(mouseY_pos, pY, pY + pH, -20, 20), -20, 20);

  // --- 新增：未偵測到手部的提示 ---
  if (predictions.length === 0) {
    fill(255, 50, 50);
    textSize(16);
    textAlign(CENTER, TOP);
    text("尚未偵測到手部，請將手移入畫面", pX + pW/2, pY + 60);
  }

  // --- UI 最上層：標題 (位移最大，看起來最靠近玩家) ---
  push();
  translate(offsetX * 1.5, offsetY * 1.5);
  fill(0, 200, 255);
  textAlign(CENTER, TOP);
  textSize(32); // 放大選單標題
  text("選擇學習關卡", pX + pW/2, pY + 30);
  
  // --- 新增：大師成就解鎖提示 (當四個關卡都為 true 時觸發) ---
  if (achievements[0] && achievements[1] && achievements[2] && achievements[3]) {
    push();
    drawingContext.shadowBlur = 15;
    drawingContext.shadowColor = "rgba(255, 200, 0, 1)";
    fill(255, 200, 0);
    textSize(18);
    text("🏅 恭喜獲得「教育心理學大師」稱號！", pX + pW/2, pY + 70);
    drawingContext.shadowBlur = 0; // 重置發光效果，避免引發效能崩潰當機
    pop();
  }
  pop(); // 結束標題層

  // --- UI 中層：選項按鈕 (基準位移) ---
  push();
  translate(offsetX * 1.0, offsetY * 1.0);
  textAlign(CENTER, TOP); // 確保文字對齊不受前一層 pop 影響
  let menuItems = ["1. 行為主義 (操作制約)", "2. 認知主義 (訊息處理)", "3. 建構主義 (知識搭建)", "4. 第四關：3D 視覺互動系統"];
  let allClear = achievements[0] && achievements[1] && achievements[2] && achievements[3];
  if (allClear) menuItems.push("▶ 系統重置 (清除所有進度)");
  
  let startY = pY + 80; 
  let spacing = allClear ? 45 : 55; // 縮小間距以容納所有選項
  
  textSize(20); // 固定選單項目文字大小
  for (let i = 0; i < menuItems.length; i++) {
    let itemY = startY + i * spacing; 
    // --- 新增：判斷是否已通關並在文字後方加上徽章與最快時間 ---
    let displayText = menuItems[i];
    if (i < 4 && achievements[i]) {
      displayText += " [★ 已通關]";
      if (bestTimes[i] !== null) {
        displayText += ` (最快: ${bestTimes[i]}秒)`;
      }
    }
    
    // 恢復統一的水藍色，重置按鈕保持紅色警告色
    let isResetBtn = (i === 4);
    let baseColor = isResetBtn ? color(255, 80, 80) : color(0, 200, 255); 
    let pulseColor = isResetBtn ? color(255, 80, 80, map(sin(frameCount * 0.1), -1, 1, 100, 200)) : color(0, 200, 255, map(sin(frameCount * 0.1), -1, 1, 100, 200));

    if (i === menuSelection) {
      // 選中效果
      // 呼吸燈閃爍效果：利用 sin 函數讓透明度在 100 到 200 之間變化
      fill(pulseColor);
      rect(pX + 20, itemY, pW - 40, 45, 5); // 加高選中框
      
      // 繪製蓄力進度條
      if (confirmTimer > 0) {
        fill(255, 255, 0);
        let barW = map(confirmTimer, 0, confirmThreshold, 0, pW - 60);
        rect(pX + 30, itemY + 36, barW, 6); // 進度條加粗並下移
      }

      fill(0);
      text("> " + displayText + " <", pX + pW/2, itemY + 12);
    } else {
      // 未選中效果
      stroke(baseColor);
      noFill();
      rect(pX + 20, itemY, pW - 40, 45, 5); // 加高未選中框
      noStroke();
      fill(baseColor);
      text(displayText, pX + pW/2, itemY + 12);
    }
  }
  pop(); // 結束選項層

  // --- UI 底層：操作說明 (位移最小，看起來在比較遠的地方) ---
  push();
  translate(offsetX * 0.5, offsetY * 0.5);
  textAlign(CENTER, TOP); 
  textSize(18); // 放大操作說明文字
  fill(255, 200, 0);
  text("💡 上下移動手勢進行選單切換", pX + pW/2, pY + pH - 60);
  text("👉 捏合 (Pinch) 停留來確認", pX + pW/2, pY + pH - 30);
  pop(); // 結束底層
}

function drawControls(screenX, screenW, screenY, screenH, consoleW) {
  // --- 手機版 UI 自適應放大 ---
  let uiScale = width < 850 ? 1.35 : 1.0; 

  let controlAreaX = screenX + screenW;
  let consoleX = (width - (width * 0.85)) / 2;
  let controlAreaW = consoleW - screenW - (consoleW * 0.1);
  let dpadX = controlAreaX + (controlAreaW * 0.35);
  let dpadY = screenY + (screenH * 0.3);

  // --- 新增：十字方向鍵 (D-Pad) 按壓狀態判定 ---
  let dUp_hand = dist(mouseX_pos, mouseY_pos, dpadX, dpadY - 30 * uiScale);
  let isPressedUp = (dUp_hand < 25 * uiScale && isPinching) || keyIsDown(UP_ARROW);

  let dDown_hand = dist(mouseX_pos, mouseY_pos, dpadX, dpadY + 30 * uiScale);
  let isPressedDown = (dDown_hand < 25 * uiScale && isPinching) || keyIsDown(DOWN_ARROW);

  let dLeft_hand = dist(mouseX_pos, mouseY_pos, dpadX - 30 * uiScale, dpadY);
  let isPressedLeft = (dLeft_hand < 25 * uiScale && isPinching) || keyIsDown(LEFT_ARROW);

  let dRight_hand = dist(mouseX_pos, mouseY_pos, dpadX + 30 * uiScale, dpadY);
  let isPressedRight = (dRight_hand < 25 * uiScale && isPinching) || keyIsDown(RIGHT_ARROW);

  let anyDPadPressed = isPressedUp || isPressedDown || isPressedLeft || isPressedRight;
  let offsetDPad = anyDPadPressed ? 3 : 0;

  push();
  translate(dpadX, dpadY);
  scale(uiScale);
  noStroke();
  
  // 1. 十字鍵底部深色陰影 (固定不動，增加立體感)
  fill(15, 15, 20); 
  rect(-15, -45 + 3, 30, 90, 5);
  rect(-45, -15 + 3, 90, 30, 5);

  // 2. 十字鍵主體 (根據按壓狀態位移與變暗)
  fill(anyDPadPressed ? color(15, 15, 20) : color(25, 25, 30));
  rect(-15, -45 + offsetDPad, 30, 90, 5);
  rect(-45, -15 + offsetDPad, 90, 30, 5);

  // 3. 十字鍵中央凹槽
  fill(anyDPadPressed ? color(30, 30, 35) : color(40, 40, 45));
  ellipse(0, offsetDPad, 15, 15);

  // --- 新增：十字鍵防滑條紋 (Anti-slip Grip) ---
  push();
  strokeWeight(1);
  let stripeShadow = color(10, 10, 15);
  let stripeHighlight = color(60, 60, 70);

  // 定義橫向條紋 (上下鍵用)
  let drawHStripe = (x, y) => {
    stroke(stripeShadow); line(x - 8, y + offsetDPad, x + 8, y + offsetDPad);
    stroke(stripeHighlight); line(x - 8, y + 1 + offsetDPad, x + 8, y + 1 + offsetDPad);
  };
  // 定義直向條紋 (左右鍵用)
  let drawVStripe = (x, y) => {
    stroke(stripeShadow); line(x, y - 8 + offsetDPad, x, y + 8 + offsetDPad);
    stroke(stripeHighlight); line(x + 1, y - 8 + offsetDPad, x + 1, y + 8 + offsetDPad);
  };

  // 繪製各方向的 3 條防滑紋
  drawHStripe(0, -36); drawHStripe(0, -31); drawHStripe(0, -26); // 上
  drawHStripe(0, 26); drawHStripe(0, 31); drawHStripe(0, 36); // 下
  drawVStripe(-36, 0); drawVStripe(-31, 0); drawVStripe(-26, 0); // 左
  drawVStripe(36, 0); drawVStripe(31, 0); drawVStripe(36, 0); // 右
  pop();

  // --- 新增：方向鍵刻痕箭頭 (Directional Arrows) 標示更清楚 ---
  push();
  fill(anyDPadPressed ? color(10, 10, 15) : color(20, 20, 25)); // 內凹深色刻痕
  noStroke();
  triangle(0, -22 + offsetDPad, -4, -14 + offsetDPad, 4, -14 + offsetDPad); // 上
  triangle(0, 22 + offsetDPad, -4, 14 + offsetDPad, 4, 14 + offsetDPad); // 下
  triangle(-22, offsetDPad, -14, -4 + offsetDPad, -14, 4 + offsetDPad); // 左
  triangle(22, offsetDPad, 14, -4 + offsetDPad, 14, 4 + offsetDPad); // 右
  pop();

  // 4. 被按下的方向給予微光提示 (增加按壓的視覺回饋)
  if (isPressedUp) { fill(255, 255, 255, 30); rect(-15, -45 + offsetDPad, 30, 30, 5, 5, 0, 0); }
  if (isPressedDown) { fill(255, 255, 255, 30); rect(-15, 15 + offsetDPad, 30, 30, 0, 0, 5, 5); }
  if (isPressedLeft) { fill(255, 255, 255, 30); rect(-45, -15 + offsetDPad, 30, 30, 5, 0, 0, 5); }
  if (isPressedRight) { fill(255, 255, 255, 30); rect(15, -15 + offsetDPad, 30, 30, 0, 5, 5, 0); }
  pop();

  // 復古紅色 A / B 按鈕
  let btnY = screenY + (screenH * 0.65);
  let btnX_A = controlAreaX + (controlAreaW * 0.75);
  let btnX_B = controlAreaX + (controlAreaW * 0.5);
  
  // --- 新增：按鈕按壓狀態判定 (支援手勢捏合、滑鼠點擊、鍵盤 A/B 鍵) ---
  let dA_hand = dist(mouseX_pos, mouseY_pos, btnX_A, btnY);
  let isPressedA = (dA_hand < 25 * uiScale && isPinching) || keyIsDown(65); // 65: 鍵盤 A 鍵

  let dB_hand = dist(mouseX_pos, mouseY_pos, btnX_B, btnY + 10 * uiScale);
  let isPressedB = (dB_hand < 25 * uiScale && isPinching) || keyIsDown(66); // 66: 鍵盤 B 鍵

  // 設定按下時的位移量
  let offsetA = isPressedA ? 3 : 0;
  let offsetB = isPressedB ? 3 : 0;

  push();
  translate(btnX_B, btnY + 10 * uiScale);
  scale(uiScale);
  fill(20, 20, 25); 
  ellipse(2, 4, 40, 40);
  fill(isPressedB ? color(150, 30, 30) : color(200, 40, 40)); 
  ellipse(offsetB, offsetB, 40, 40);
  fill(180, 185, 195);
  textSize(14);
  textAlign(CENTER, CENTER);
  text("B", 0, 25);
  pop();
  
  push();
  translate(btnX_A, btnY);
  scale(uiScale);
  fill(20, 20, 25); 
  ellipse(2, 4, 40, 40);
  fill(isPressedA ? color(150, 30, 30) : color(200, 40, 40)); 
  ellipse(offsetA, offsetA, 40, 40);
  fill(180, 185, 195);
  textSize(14);
  textAlign(CENTER, CENTER);
  text("A", 0, 25);
  pop();

  // --- 新增：喇叭孔 (Speaker Grills) ---
  push();
  translate(dpadX - 25 * uiScale, btnY + 90 * uiScale);
  scale(uiScale);
  noStroke();
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 4; j++) {
      let offsetX = (j % 2 === 0) ? 0 : 8; // 交錯排列的網格孔設計
      let hX = i * 16 + offsetX;
      let hY = j * 12;
      
      // 1. 喇叭孔下緣高光 (營造內凹厚度感)
      fill(100, 105, 115);
      ellipse(hX, hY + 1.5, 6, 6);
      
      // 2. 喇叭內部深色孔洞
      fill(15, 15, 20);
      ellipse(hX, hY, 6, 6);
    }
  }
  pop();
}

// 當按下按鍵時切換場景 (測試用)
function keyPressed() {
  // 鍵盤按下時也可嘗試解鎖並播放音訊
  userStartAudio();
  let isAllClear = achievements[0] && achievements[1] && achievements[2] && achievements[3];
  if (bgMusic && !bgMusic.isPlaying() && !isAllClear) {
    bgMusic.loop();
  }

  if (key === 's' || key === 'S') {
    currentScene = 1;
    score = 0; // 重置分數
    items = [];
    floatingTexts = [];
  }
  if (key === 'd' || key === 'D') {
    currentScene = 2;
    // 這邊手動計算一次 playArea 範圍傳進去初始化
    let cW = width * 0.85;
    let cH = height * 0.85;
    let cX = (width - cW) / 2;
    let cY = (height - cH) / 2;
    let sW = cW * 0.65;
    let sH = cH * 0.75;
    let sX = cX + (cW * 0.05);
    let sY = cY + (cH - sH) / 2;
    initGameTwo(sX + 30, sY + 40, sW - 60, sH - 70);
  }
  if (key === 'f' || key === 'F') {
    currentScene = 3;
    let cW = width * 0.85;
    let cH = height * 0.85;
    let cX = (width - cW) / 2;
    let cY = (height - cH) / 2;
    let sW = cW * 0.65;
    let sH = cH * 0.75;
    let sX = cX + (cW * 0.05);
    let sY = cY + (cH - sH) / 2;
    initGameThree(sX + 30, sY + 40, sW - 60, sH - 70);
  }
  if (key === 'r' || key === 'R') {
    if (currentScene === 2) {
      let cW = width * 0.85;
      let cH = height * 0.85;
      let cX = (width - cW) / 2;
      let cY = (height - cH) / 2;
      let sW = cW * 0.65;
      let sH = cH * 0.75;
      let sX = cX + (cW * 0.05);
      let sY = cY + (cH - sH) / 2;
      initGameTwo(sX + 30, sY + 40, sW - 60, sH - 70);
    }
    if (currentScene === 3) {
      let cW = width * 0.85;
      let cH = height * 0.85;
      let cX = (width - cW) / 2;
      let cY = (height - cH) / 2;
      let sW = cW * 0.65;
      let sH = cH * 0.75;
      let sX = cX + (cW * 0.05);
      let sY = cY + (cH - sH) / 2;
      initGameThree(sX + 30, sY + 40, sW - 60, sH - 70);
    }
  }
  if (key === 'o' || key === 'O' || keyCode === ENTER) {
    isHandOpen = true; // 模擬五指張開
  }
}

function keyReleased() {
  if (key === 'o' || key === 'O' || keyCode === ENTER) {
    isHandOpen = false;
  }
}

function mousePressed() {
  // 現代瀏覽器限制自動播放聲音，需透過點擊畫面解鎖音訊
  userStartAudio();
  let isAllClear = achievements[0] && achievements[1] && achievements[2] && achievements[3];
  if (bgMusic && !bgMusic.isPlaying() && !isAllClear) {
    bgMusic.loop();
  }
}

function touchStarted() {
  // 支援手機觸控解鎖音訊
  userStartAudio();
  let isAllClear = achievements[0] && achievements[1] && achievements[2] && achievements[3];
  if (bgMusic && !bgMusic.isPlaying() && !isAllClear) {
    bgMusic.loop();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
