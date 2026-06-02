// === 全域變數宣告 ===
let currentScene = -1;  // -1: 起始畫面, 0: 主選單, 1: 遊戲一, 2: 遊戲二, 3: 遊戲三
let mouseX_pos = 0;     // PoseNet 平滑後的 X (需在你的 PoseNet 邏輯中更新)
let mouseY_pos = 0;     // PoseNet 平滑後的 Y

// === 手勢辨識介接變數 ===
// 當你使用 ml5.handpose 時，請根據食指與拇指距離判斷
// 如果距離小於門檻，請將 isPinching 設為 true
let isPinching = false; 
let isPinchingPrev = false; // 用於偵測「剛捏合」的瞬間

// 新增：五指張開手勢與選單選擇
let isHandOpen = false; 
let isHandOpenPrev = false; // 用於偵測「剛張開」的瞬間
let menuSelection = 0;   // 0: 行為, 1: 認知, 2: 建構

let confirmTimer = 0;    // 確認進度計時器
let confirmThreshold = 90; // 延長確認時間，需要張開手維持約 1.5 秒

// === 遊戲狀態與計時器 ===
let gameState = "playing"; // playing, win, lose, intro
let countdown = 0;
let lastTimerTick = 0;

// === ml5.js 手勢辨識變數 ===
let handpose;
let predictions = [];
let modelLoaded = false; // 用於追蹤 AI 模型是否載入完成

// 遊戲一：行為主義老鼠迷宮變數
let items = [];         // 儲存所有掉落物 (起司與電擊)
let score = 0;          // 分數
let gameTimer = 0;      // 用於產生掉落物的計時器

// 遊戲二：認知主義記憶翻牌變數
let video;              // 攝像頭影像
let cards = [];         // 儲存卡牌物件
let lockBoard = false;  // 防止在判定勝負時繼續翻牌
let matchCount = 0;     // 配對成功的次數
let matchTimer = 0;     // 配對失敗後的自動關牌計時器
let cardsToClose = [];  // 暫時儲存需要翻回去的卡牌

// 遊戲三：建構主義積木搭建變數
let floatingBlocks = []; // 飄浮中的積木
let stackedBlocks = [];  // 已堆疊好的積木
let heldBlock = null;    // 目前手中抓著的積木
let buildTimer = 0;
let floorY = 0;          // 地板高度
let shakeTimer = 0;      // 震動計時器

function setup() {
  // 建立橫式全螢幕畫布
  createCanvas(windowWidth, windowHeight);
  // 初始化攝像頭
  video = createCapture(VIDEO);
  video.size(640, 480); // 建議固定辨識解析度以增進效能
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
    // 徹底優化：比較「指尖」與「指節」離手腕的相對距離，避免受手部離鏡頭遠近影響
    let openCount = 0;
    [8, 12, 16, 20].forEach(tipIdx => {
      let jointIdx = tipIdx - 2;
      let tipDist = dist(hand.keypoints[tipIdx].x, hand.keypoints[tipIdx].y, wrist.x, wrist.y);
      let jointDist = dist(hand.keypoints[jointIdx].x, hand.keypoints[jointIdx].y, wrist.x, wrist.y);
      if (tipDist > jointDist) openCount++;
    });
    isHandOpen = openCount >= 3; // 只要有三根手指伸直就判定為張開
  } else {
    // 如果沒偵測到手，重置狀態
    isHandOpen = false;
    isPinching = false;
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

  // 主機灰色外殼
  noStroke();
  fill(60, 65, 75); 
  rect(consoleX, consoleY, consoleW, consoleH, 20);

  // 主機外殼深色陰影（增加立體厚度感）
  fill(45, 50, 55);
  rect(consoleX, consoleY + consoleH - 15, consoleW, 15, 0, 0, 20, 20);

  // === 3. 頂部：復古卡帶插槽 ===
  fill(30, 30, 35);
  rect(width / 2 - 180, consoleY + 15, 360, 20, 5);

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

  // === 5. 真正的遊戲畫面渲染區（CRT 電視綠色感） ===
  noStroke();
  fill(15, 25, 20); // 暗綠色底色
  let playAreaX = screenX + 30;
  let playAreaY = screenY + 40;
  let playAreaW = screenW - 60;
  let playAreaH = screenH - 70;
  rect(playAreaX, playAreaY, playAreaW, playAreaH);

  // 模擬 CRT 螢幕微弱的掃描線特效
  stroke(0, 255, 100, 15); // 綠色透明線條
  strokeWeight(2);
  let scanlineOffset = (frameCount * 0.5) % 6;
  for (let sY = playAreaY + scanlineOffset; sY < playAreaY + playAreaH; sY += 6) {
    line(playAreaX, sY, playAreaX + playAreaW, sY);
  }
  
  // --- 新增：AI 模型載入狀態防護 ---
  if (!modelLoaded) {
    fill(255, 255, 0);
    textSize(22);
    textAlign(CENTER, CENTER);
    text("AI 手勢模型載入中，請稍候...", width / 2, height / 2);
    pop(); // 結束震動效果的 push
    return; // 模型未載入時先暫停繪製後續關卡
  }

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
      
      // 選單互動邏輯：擴大感應區到螢幕中央 30%-70% 處
      let menuY = constrain(mouseY_pos, height * 0.3, height * 0.7);
      menuSelection = floor(map(menuY, height * 0.3, height * 0.7, 0, 3));
      menuSelection = constrain(menuSelection, 0, 2);

      // --- 優化：蓄力確認機制 (改為捏合) ---
      if (isPinching && modelLoaded && predictions.length > 0) {
        confirmTimer++;
        if (confirmTimer >= confirmThreshold) {
          handleMenuSelection(playAreaX, playAreaY, playAreaW, playAreaH);
          confirmTimer = 0; // 觸發後重置
        }
      } else {
        confirmTimer = Math.max(0, confirmTimer - 2); // 沒張手時進度條快速退回
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
  }

  // === 6. 右側：實體遊戲按鈕區 ===
  drawControls(screenX, screenW, screenY, screenH, consoleW);

  // --- 全域手部游標顯示 ---
  if (predictions.length > 0) {
    push();
    if (isPinching) {
      fill(255, 0, 0); // 捏合時變紅色
      noStroke();
      ellipse(mouseX_pos, mouseY_pos, 15, 15);
      noFill();
      stroke(255, 0, 0);
      strokeWeight(2);
      ellipse(mouseX_pos, mouseY_pos, 30, 30);
    } else {
      fill(0, 255, 100, 200); // 沒捏合時為半透明綠色
      stroke(0, 255, 100);
      strokeWeight(2);
      ellipse(mouseX_pos, mouseY_pos, 20, 20);
    }
    pop();
  }

  isPinchingPrev = isPinching; // 紀錄這一影格的狀態供下一影格比較
  isHandOpenPrev = isHandOpen; // 紀錄這一影格的狀態供下一影格比較
  pop(); // 結束震動效果的作用範圍
}

// --- 核心：更新倒數計時 ---
function updateCountdown() {
  if (gameState === "playing" && millis() - lastTimerTick >= 1000) {
    countdown--;
    lastTimerTick = millis();
    if (countdown <= 0) {
      countdown = 0;
      gameState = "lose";
    }
  }
}

// --- 核心：繪製關卡介紹畫面 ---
function drawIntroScreen(title, goal, control, theory, pX, pY, pW, pH) {
  push();
  fill(0, 220); // 深色背景遮罩
  noStroke();
  rect(pX, pY, pW, pH);

  // --- 新增：閃爍像素裝飾 ---
  // 1. 隨機像素點點，營造電子雜訊感
  for (let i = 0; i < 20; i++) {
    // 利用 frameCount 做簡單的頻率控制，讓點點看起來在閃動
    if (frameCount % 10 < 5) {
      fill(0, 255, 100, random(50, 150));
      rect(random(pX, pX + pW), random(pY, pY + pH), 4, 4);
    }
  }

  // 2. 復古電子感呼吸邊框 (利用 sin 讓透明度產生律動)
  stroke(0, 255, 100, 150 + sin(frameCount * 0.1) * 100);
  strokeWeight(2);
  noFill();
  rect(pX + 5, pY + 5, pW - 10, pH - 10, 2);
  noStroke();
  
  textAlign(CENTER, CENTER);
  fill(0, 255, 100);
  textSize(32); // 放大標題
  text(title, pX + pW / 2, pY + pH * 0.2);
  
  fill(255);
  textSize(18); // 放大目標與操作
  textStyle(BOLD);
  text("GOAL: " + goal, pX + pW / 2, pY + pH * 0.35);
  text("CONTROL: " + control, pX + pW / 2, pY + pH * 0.42);
  
  textStyle(NORMAL);
  textSize(15); // 放大理論文字
  fill(200, 200, 255);
  text(theory, pX + 40, pY + pH * 0.52, pW - 80); // 使用寬度參數實現自動換行

  // --- 新增：明確的開始按鈕與蓄力機制 ---
  let btnW = 160;
  let btnH = 45;
  let btnX = pX + (pW - btnW) / 2;
  let btnY = pY + pH * 0.78;

  let isHovering = mouseX_pos > btnX && mouseX_pos < btnX + btnW &&
                   mouseY_pos > btnY && mouseY_pos < btnY + btnH;

  fill(255, 200, 0);
  textSize(14);
  text("💡 將游標移至按鈕並「捏合 (Pinch)」停留", pX + pW / 2, btnY - 20);

  if (isHovering) {
    fill(0, 255, 100, map(sin(frameCount * 0.1), -1, 1, 100, 200));
    rect(btnX, btnY, btnW, btnH, 5);
    fill(0);
    textSize(16);
    text("開始挑戰", pX + pW / 2, btnY + 22);

    if (isPinching && modelLoaded && predictions.length > 0) {
      confirmTimer++;
      fill(255, 255, 0);
      let barW = map(confirmTimer, 0, confirmThreshold, 0, btnW - 10);
      rect(btnX + 5, btnY + btnH - 10, barW, 6);
      if (confirmTimer >= confirmThreshold) {
        gameState = "playing";
        lastTimerTick = millis();
        confirmTimer = 0; // 觸發後重置計時器
      }
    } else {
      confirmTimer = Math.max(0, confirmTimer - 2);
    }
  } else {
    noFill();
    stroke(0, 255, 100);
    strokeWeight(2);
    rect(btnX, btnY, btnW, btnH, 5);
    noStroke();
    fill(0, 255, 100);
    textSize(16);
    text("開始挑戰", pX + pW / 2, btnY + 22);
    
    // 游標不在按鈕上時，進度條也會退回
    confirmTimer = Math.max(0, confirmTimer - 2);
  }
  pop();
}

// --- 核心：繪製結束畫面 ---
function drawEndScreen(pX, pY, pW, pH) {
  push();
  fill(0, 180);
  noStroke();
  rect(pX, pY, pW, pH);
  
  textAlign(CENTER, CENTER);
  if (gameState === "win") {
    fill(0, 255, 100);
    textSize(40); // 放大結束標題
    text("挑戰成功！", pX + pW / 2, pY + pH / 2 - 20);
  } else {
    fill(255, 50, 50);
    textSize(40);
    text("挑戰失敗", pX + pW / 2, pY + pH / 2 - 20);
  }
  
  // --- 新增：明確的回選單按鈕 ---
  let btnW = 160;
  let btnH = 45;
  let btnX = pX + (pW - btnW) / 2;
  let btnY = pY + pH * 0.7;

  let isHovering = mouseX_pos > btnX && mouseX_pos < btnX + btnW &&
                   mouseY_pos > btnY && mouseY_pos < btnY + btnH;

  fill(255, 200, 0);
  textSize(14);
  noStroke();
  text("💡 將游標移至按鈕並「捏合 (Pinch)」停留", pX + pW / 2, btnY - 20);

  if (isHovering) {
    fill(0, 255, 100, map(sin(frameCount * 0.1), -1, 1, 100, 200));
    rect(btnX, btnY, btnW, btnH, 5);
    fill(0);
    textSize(16);
    text("回主選單", pX + pW / 2, btnY + 22);

    if (isPinching && modelLoaded && predictions.length > 0) {
      confirmTimer++;
      fill(255, 255, 0);
      let barW = map(confirmTimer, 0, confirmThreshold, 0, btnW - 10);
      rect(btnX + 5, btnY + btnH - 10, barW, 6);
      if (confirmTimer >= confirmThreshold) {
        currentScene = 0;
        confirmTimer = 0;
      }
    } else {
      confirmTimer = Math.max(0, confirmTimer - 2);
    }
  } else {
    noFill();
    stroke(0, 255, 100);
    strokeWeight(2);
    rect(btnX, btnY, btnW, btnH, 5);
    noStroke();
    fill(0, 255, 100);
    textSize(16);
    text("回主選單", pX + pW / 2, btnY + 22);
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
    this.speed = random(2, 5);              // 隨機掉落速度
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
    let theoryText = "理論背景：斯金納的操作制約。行為是透過「正增強」（起司獎勵）與「懲罰」（電擊）來形塑的。當行為產生積極結果時，該行為在未來發生的機率就會增加。";
    drawIntroScreen("行為主義", 
                    "吃到起司獲得 100 分。", 
                    "移動手勢控制老鼠位置。", 
                    theoryText,
                    pX, pY, pW, pH);
    return;
  }

  if (gameState !== "playing") {
    drawEndScreen(pX, pY, pW, pH);
    return;
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

  // 畫老鼠 (全新頂視角，更像老鼠的特徵)
  push();
  translate(playerX, playerY);
  
  // 1. 老鼠尾巴
  noFill();
  stroke(150);
  strokeWeight(3);
  bezier(0, 10, 15, 25, -15, 35, 5, 45); // 彎曲的長尾巴
  
  // 2. 老鼠耳朵
  noStroke();
  fill(180);
  ellipse(-12, -5, 16, 16); // 左耳外框
  ellipse(12, -5, 16, 16);  // 右耳外框
  fill(255, 150, 150);
  ellipse(-12, -5, 8, 8);   // 左耳內耳
  ellipse(12, -5, 8, 8);    // 右耳內耳
  
  // 3. 老鼠身體與尖尖的臉
  fill(200);
  ellipse(0, 0, 26, 35);     // 圓圓的身體
  triangle(-12, -5, 12, -5, 0, -22); // 尖尖的鼻子輪廓
  
  // 4. 眼睛
  fill(0);
  ellipse(-5, -12, 4, 4); // 左眼
  ellipse(5, -12, 4, 4);  // 右眼
  
  // 5. 鬍鬚
  stroke(200);
  strokeWeight(1);
  line(-3, -18, -18, -22); // 左上鬍鬚
  line(-3, -16, -18, -16); // 左下鬍鬚
  line(3, -18, 18, -22);   // 右上鬍鬚
  line(3, -16, 18, -16);   // 右下鬍鬚
  
  // 6. 鼻子
  noStroke();
  fill(255, 100, 100);
  ellipse(0, -22, 6, 6);  // 粉紅小鼻子
  pop();
  
  // B. 自動生成物件
  gameTimer++;
  if (gameTimer % 45 === 0) {
    items.push(new FallingItem(pX, pY, pW, pH));
  }

  // C. 處理所有掉落物 (更新、顯示、碰撞)
  for (let i = items.length - 1; i >= 0; i--) {
    items[i].update();
    items[i].display();

    // 基礎碰撞偵測 (配合放大，將判定距離從 30 增加到 45)
    let d = dist(playerX, playerY, items[i].x, items[i].y + 15); // 將判定中心下移到物件中心
    if (d < 45) {
      if (items[i].type === "cheese") {
        score += 10; 
        if (score >= 100) gameState = "win"; // 滿百分勝利
        // 綠色閃爍效果
        push();
        fill(0, 255, 0, 100);
        rect(pX, pY, pW, pH);
        pop();
      } else {
        score -= 20; // 懲罰：削弱行為
        shakeTimer = 15; // 觸發畫面震動回饋
        // 紅色閃爍效果
        push();
        fill(255, 0, 0, 100);
        rect(pX, pY, pW, pH);
        pop();
      }
      items.splice(i, 1); // 碰到後消失
    } 
    else if (items[i].isOffScreen()) {
      items.splice(i, 1); // 掉出螢幕後消失
    }
  }

  // D. 顯示分數與標題
  fill(0, 255, 100);
  textSize(14);
  textAlign(LEFT, TOP);
  text("獎勵積分: " + score, pX + 10, pY + 10);
  textAlign(CENTER, TOP);
  text("行為主義：獲得 100 分", pX + pW/2, pY + 10);

  // 顯示計時器
  textAlign(RIGHT, TOP);
  fill(255, 200, 0);
  text("時間: " + countdown, pX + pW - 10, pY + 10);

  textAlign(CENTER, BOTTOM);
  textSize(10);
  text("起司 = +10 | 電擊 = -20", pX + pW/2, pY + pH - 10);

  // 手部游標輔助
  noFill();
  stroke(0, 255, 100);
  ellipse(mouseX_pos, mouseY_pos, 25, 25);
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
      // 發光效果：利用原生 Canvas 陰影 API
      drawingContext.shadowBlur = 30;
      drawingContext.shadowColor = "rgba(0, 255, 100, 1)";
      drawingContext.shadowOffsetY = 0;
      this.matchAnimTimer--; // 更新計時器
    } else {
      // --- 優化：翻轉時的動態 3D 陰影 ---
      // 隨著卡片翻轉，陰影會變得更模糊且往下偏移，產生懸浮感
      drawingContext.shadowBlur = 10 + flipProgress * 20;
      drawingContext.shadowColor = "rgba(0, 0, 0, 0.5)";
      drawingContext.shadowOffsetY = 5 + flipProgress * 12;
    }

    // 將座標系統移到卡片中心點，方便進行中心縮放
    translate(this.x + this.w / 2, this.y + this.h / 2 + offsetY);
    
    // --- 優化：模擬 3D 透視放大 ---
    // 當卡片轉向側面時，同時稍微放大，產生往鏡頭靠近的 3D 錯覺
    let popScale = 1.0 + flipProgress * 0.15; // 最高放大 15%
    scale(abs(this.scaleX) * popScale, popScale); 

    stroke(0, 255, 100);
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
      
      // --- 新增：牌背復古幾何裝飾 ---
      push();
      noFill();
      // 1. 霓虹藍色內框
      stroke(50, 100, 200, 150); 
      strokeWeight(2);
      rect(-this.w * 0.4, -this.h * 0.4, this.w * 0.8, this.h * 0.8, 3);
      
      // 2. 霓虹紅色圓形與對角線交叉
      stroke(220, 50, 50, 100);
      strokeWeight(1);
      ellipse(0, 0, this.w * 0.6, this.w * 0.6);
      line(-this.w * 0.4, -this.h * 0.4, this.w * 0.4, this.h * 0.4);
      line(this.w * 0.4, -this.h * 0.4, -this.w * 0.4, this.h * 0.4);
      pop();

      // 中心懸浮的發光問號
      noStroke();
      fill(150, 255, 200);
      textAlign(CENTER, CENTER);
      textSize(24);
      text("?", 0, 0);
    }
    pop();
  }

  update(px, py) {
    if (dist(px, py, this.x + this.w/2, this.y + this.h/2) < this.w/2) {
      // 優化：改為「觸發式」翻牌 (Pinch Trigger)
      // 只有在這一影格剛捏合，且上一影格沒捏合時才觸發
      let pinchTrigger = isPinching && !isPinchingPrev;
      if (!this.flipped && !this.matched && !lockBoard && pinchTrigger) {
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
    let theoryText = "理論背景：訊息處理論。學習涉及訊息的編碼、儲存與檢索。配對相同卡片的過程模擬了大腦如何辨識特徵，並將短期記憶中的資訊與長期記憶中的既有架構進行聯結。";
    drawIntroScreen("認知主義", 
                    "配對所有卡片以完成資訊編碼。", 
                    "捏合手勢進行翻牌。", 
                    theoryText,
                    pX, pY, pW, pH);
    return;
  }

  if (gameState !== "playing") {
    drawEndScreen(pX, pY, pW, pH);
    return;
  }

  updateCountdown();

  // A. 繪製視訊背景 (鏡像處理，更直覺)
  push();
  translate(pX + pW, pY);
  scale(-1, 1);
  image(video, 0, 0, pW, pH);
  pop();

  // B. 手部游標顯示
  if (isPinching) {
    fill(255, 0, 0); // 抓取時變紅色
    ellipse(mouseX_pos, mouseY_pos, 10, 10);
    noFill();
    stroke(255, 0, 0);
    ellipse(mouseX_pos, mouseY_pos, 25, 25);
  } else {
    fill(0, 255, 100);
    noStroke();
    ellipse(mouseX_pos, mouseY_pos, 20, 20);
  }

  // C. 處理所有卡牌
  for (let i = 0; i < cards.length; i++) {
    cards[i].display();
    if (cards[i].update(mouseX_pos, mouseY_pos)) {
      checkMatching();
    }
  }

  // D. 處理配對失敗的自動關牌 (計時器)
  if (cardsToClose.length > 0) {
    matchTimer++;
    if (matchTimer > 60) { // 顯示 1 秒後關掉
      for (let c of cardsToClose) c.flipped = false;
      cardsToClose = [];
      matchTimer = 0;
      lockBoard = false;
    }
  }

  // E. 介面文字
  fill(0, 255, 100);
  textSize(14);
  textAlign(CENTER, TOP);
  text("認知主義：完成所有配對", pX + pW/2, pY + 10);

  // 顯示計時器
  textAlign(RIGHT, TOP);
  fill(255, 200, 0);
  text("時間: " + countdown, pX + pW - 10, pY + 10);

  // --- 新增：配對進度條 ---
  let progressW = pW * 0.6;
  let progressH = 12;
  let progressX = pX + (pW - progressW) / 2;
  let progressY = pY + pH - 45;

  // 進度條外框
  stroke(0, 255, 100);
  strokeWeight(1);
  noFill();
  rect(progressX, progressY, progressW, progressH, 6);

  // 填充進度 (根據 matchCount，總共需配對 3 對)
  let fillW = map(matchCount, 0, 3, 0, progressW);
  noStroke();
  fill(0, 255, 100, 200);
  rect(progressX, progressY, fillW, progressH, 6);

  // 百分比文字
  fill(0, 255, 100);
  textSize(10);
  textAlign(CENTER, BOTTOM);
  let percent = floor((matchCount / 3) * 100);
  text("資訊編碼進度: " + percent + "%", pX + pW / 2, progressY - 5);

  if (matchCount === 3) {
    gameState = "win";
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
      lockBoard = true;
      cardsToClose = [flipped[0], flipped[1]];
      matchTimer = 0; // 關鍵：確保計時器從 0 開始，避免直接跳過顯示時間
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
  lockBoard = false;
  cardsToClose = []; // 初始化時清空待關閉清單
  matchTimer = 0;    // 初始化時重置計時器
}

// --- 遊戲三：物件導向類別 (建構積木) ---
class ConstructBlock {
  constructor(pX, pY, pW, pH, label) {
    this.pX = pX; this.pY = pY; this.pW = pW; this.pH = pH;
    this.w = 60;
    this.h = 30;
    this.x = random(pX, pX + pW - this.w);
    this.y = random(pY, pY + pH / 2);
    this.label = label;
    this.col = color(random(100, 255), random(100, 255), random(100, 255));
    this.vx = random(-1, 1); // 隨機飄動速度
    this.vy = random(-1, 1);

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
    fill(this.col);
    stroke(255);
    strokeWeight(1);
    rect(this.x, this.y, this.w, this.h, 3);
    fill(0);
    noStroke();
    textSize(8);
    textAlign(CENTER, CENTER);
    text(this.label, this.x + this.w / 2, this.y + this.h / 2);
  }
}

// --- 遊戲三：核心邏輯 Function ---
function runGameThree(pX, pY, pW, pH) {
  if (gameState === "intro") {
    let theoryText = "理論背景：社會建構主義。知識並非被動接收，而是由學習者主動建構的。透過親手捕捉與堆疊「經驗」與「反思」等積木，學習者正在將新資訊整合進自我的認知結構中。";
    drawIntroScreen("建構主義", 
                    "搭建一座 4 層高的知識塔。", 
                    "捏合抓取，放開後堆疊。", 
                    theoryText,
                    pX, pY, pW, pH);
    return;
  }

  if (gameState !== "playing") {
    drawEndScreen(pX, pY, pW, pH);
    return;
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

  // B. 繪製地基
  fill(40, 50, 60);
  rect(pX + pW*0.2, pY + pH - 20, pW*0.6, 20);

  // C. 處理飄浮積木
  for (let i = floatingBlocks.length - 1; i >= 0; i--) {
    floatingBlocks[i].update();
    floatingBlocks[i].display();

    // 建構主義核心：手部捏合(Pinching)才能抓起積木
    if (heldBlock === null && isPinching) {
      let d = dist(mouseX_pos, mouseY_pos, floatingBlocks[i].x + 30, floatingBlocks[i].y + 15);
      if (d < 35) {
        heldBlock = floatingBlocks[i];
        floatingBlocks.splice(i, 1);
      }
    }
  }

  // D. 處理手中抓著的積木
  if (heldBlock !== null) {
    if (heldBlock.isFalling) {
      // 更新掉落動畫
      if (heldBlock.update()) {
        stackedBlocks.push(heldBlock); // 落地後正式加入堆疊
        heldBlock = null;
        shakeTimer = 10; // 落地震動回饋
      } else {
        heldBlock.display();
      }
    } else {
      // 被抓取中
      heldBlock.x = mouseX_pos - 30;
      heldBlock.y = mouseY_pos - 15;
      heldBlock.display();
      
      // 游標指示
      fill(255, 0, 0);
      ellipse(mouseX_pos, mouseY_pos, 10, 10);

      // 只有放開捏合手勢 (!isPinching) 且在底部區域積木才會落下
      if (!isPinching && heldBlock.y > pY + pH/2) {
        heldBlock.isFalling = true;
        heldBlock.velocityY = 0;
        // 動態計算目標落點 Y (地基高度 - 已堆疊積木總高度)
        heldBlock.targetY = (pY + pH - 20) - (stackedBlocks.length + 1) * heldBlock.h;
        heldBlock.x = pX + pW / 2 - heldBlock.w / 2; // 自動置中對齊
      }
    }
  }

  // E. 繪製已堆疊的積木
  for (let b of stackedBlocks) {
    b.display();
  }

  // F. 介面文字
  fill(0, 255, 100);
  textSize(24);
  textAlign(CENTER, TOP);
  text("建構主義：堆疊 4 個知識積木", pX + pW/2, pY + 20);

  // 顯示計時器
  textAlign(RIGHT, TOP);
  fill(255, 200, 0);
  text("時間: " + countdown, pX + pW - 20, pY + 20);
  
  if (stackedBlocks.length >= 4) {
    gameState = "win";
  }

  // 繪製手部游標 (空手或積木掉落中)
  if (heldBlock === null || heldBlock.isFalling) {
    fill(isPinching ? color(255, 0, 0) : color(0, 255, 100));
    noStroke();
    ellipse(mouseX_pos, mouseY_pos, isPinching ? 15 : 20, isPinching ? 15 : 20);
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
    countdown = 30; // 行為主義給 30 秒
    gameState = "intro";
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
  }
  // 重置狀態，避免連續觸發
  isPinching = false;
}

// --- 新增：起始情境畫面 (Boot Screen - 機台螢幕內) ---
function drawBootScreen(pX, pY, pW, pH) {
  // 封面不需要攝影機，只保留呼吸感遮罩與手部游標
  push();
  fill(20, 15, 30, 150 + sin(frameCount * 0.05) * 50);
  rect(pX, pY, pW, pH);
  pop();

  // 未偵測到手部的提示
  if (modelLoaded && predictions.length === 0) {
    fill(255, 50, 50);
    textSize(20); // 稍微放大
    textAlign(CENTER, TOP);
    text("尚未偵測到手部，請將手移入畫面", pX + pW/2, pY + 40);
  }

  push();
  textAlign(CENTER, CENTER);
  fill(0, 255, 100);
  textSize(60); // 放大全螢幕標題
  text("教育心理學博物館", pX + pW / 2, pY + pH * 0.35);
  
  fill(200, 200, 255);
  textSize(24); // 放大內文說明
  text("歡迎來到復古教育機台！\n\n在這裡，我們將透過三個經典的互動小遊戲\n帶您親身體驗 行為主義、認知主義 與 建構主義。", pX + pW / 2, pY + pH * 0.55);

  // 進入機台按鈕
  let btnW = 240;
  let btnH = 60;
  let btnX = pX + (pW - btnW) / 2;
  let btnY = pY + pH * 0.75;
  let isHovering = mouseX_pos > btnX && mouseX_pos < btnX + btnW && mouseY_pos > btnY && mouseY_pos < btnY + btnH;

  fill(255, 200, 0);
  textSize(18);
  text("💡 將游標移至按鈕並「捏合 (Pinch)」停留", pX + pW / 2, btnY - 20);

  if (isHovering) {
    fill(0, 255, 100, map(sin(frameCount * 0.1), -1, 1, 100, 200));
    rect(btnX, btnY, btnW, btnH, 10);
    fill(0);
    textSize(24);
    text("進入機台", pX + pW / 2, btnY + 30);

    if (isPinching && predictions.length > 0) {
      confirmTimer++;
      fill(255, 255, 0);
      let barW = map(confirmTimer, 0, confirmThreshold, 0, btnW - 10);
      rect(btnX + 5, btnY + btnH - 10, barW, 6);
      if (confirmTimer >= confirmThreshold) {
        currentScene = 0;
        confirmTimer = 0;
      }
    } else {
      confirmTimer = Math.max(0, confirmTimer - 2);
    }
  } else {
    noFill();
    stroke(0, 255, 100);
    strokeWeight(2);
    rect(btnX, btnY, btnW, btnH, 10);
    noStroke();
    fill(0, 255, 100);
    textSize(24);
    text("進入機台", pX + pW / 2, btnY + 30);
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

  // --- 新增：未偵測到手部的提示 ---
  if (predictions.length === 0) {
    fill(255, 50, 50);
    textSize(16);
    textAlign(CENTER, TOP);
    text("尚未偵測到手部，請將手移入畫面", pX + pW/2, pY + 60);
  }

  fill(0, 255, 100);
  textAlign(CENTER, TOP);
  textSize(32); // 放大選單標題
  text("選擇學習關卡", pX + pW/2, pY + 30);
  
  let menuItems = ["1. 行為主義 (操作制約)", "2. 認知主義 (訊息處理)", "3. 建構主義 (知識搭建)"];
  
  textSize(22); // 設定選單項目文字大小
  for (let i = 0; i < menuItems.length; i++) {
    let itemY = pY + 100 + i * 70; // 增加選項間距
    if (i === menuSelection) {
      // 選中效果
      // 呼吸燈閃爍效果：利用 sin 函數讓透明度在 100 到 200 之間變化
      fill(0, 255, 100, map(sin(frameCount * 0.1), -1, 1, 100, 200));
      rect(pX + 20, itemY, pW - 40, 50, 5); // 加高選中框
      
      // 繪製蓄力進度條
      if (confirmTimer > 0) {
        fill(255, 255, 0);
        let barW = map(confirmTimer, 0, confirmThreshold, 0, pW - 60);
        rect(pX + 30, itemY + 40, barW, 6); // 進度條加粗並下移
      }

      fill(0);
      text("> " + menuItems[i] + " <", pX + pW/2, itemY + 14);
    } else {
      // 未選中效果
      stroke(0, 255, 100);
      noFill();
      rect(pX + 20, itemY, pW - 40, 50, 5); // 加高未選中框
      noStroke();
      fill(0, 255, 100);
      text(menuItems[i], pX + pW/2, itemY + 14);
    }
  }

  textSize(18); // 放大操作說明文字
  fill(255, 200, 0);
  text("💡 上下移動手勢進行選單切換", pX + pW/2, pY + pH - 60);
  text("👉 捏合 (Pinch) 停留來確認", pX + pW/2, pY + pH - 30);
}

function drawControls(screenX, screenW, screenY, screenH, consoleW) {
  let controlAreaX = screenX + screenW;
  let consoleX = (width - (width * 0.85)) / 2;
  let controlAreaW = consoleW - screenW - (consoleW * 0.1);
  let dpadX = controlAreaX + (controlAreaW * 0.35);
  let dpadY = screenY + (screenH * 0.3);
  noStroke();
  fill(25, 25, 30); 
  rect(dpadX - 15, dpadY - 45, 30, 90, 5);
  rect(dpadX - 45, dpadY - 15, 90, 30, 5);
  fill(40, 40, 45);
  ellipse(dpadX, dpadY, 15, 15);

  // 復古紅色 A / B 按鈕
  let btnY = screenY + (screenH * 0.65);
  let btnX_A = controlAreaX + (controlAreaW * 0.75);
  let btnX_B = controlAreaX + (controlAreaW * 0.5);
  
  fill(20, 20, 25); 
  ellipse(btnX_B + 2, btnY + 4 + 10, 40, 40);
  ellipse(btnX_A + 2, btnY + 4, 40, 40);
  
  fill(200, 40, 40); 
  ellipse(btnX_B, btnY + 10, 40, 40);
  ellipse(btnX_A, btnY, 40, 40);
  
  fill(180, 185, 195);
  textSize(14);
  textAlign(CENTER, CENTER);
  text("B", btnX_B, btnY + 35);
  text("A", btnX_A, btnY + 25);
}

// 當按下按鍵時切換場景 (測試用)
function keyPressed() {
  if (key === 's' || key === 'S') {
    currentScene = 1;
    score = 0; // 重置分數
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

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
