// === 全域變數宣告 ===
let currentScene = 0; // 0:主選單, 1:老鼠迷宮, 2:Game Over, 3:Win, 4:介紹畫面, 5:手勢校準, 6:遊戲選擇
let mouseX_pos = 0, mouseY_pos = 0; // 由 PoseNet 傳入的鼻尖座標
let video; // 視訊鏡頭
let handpose; // Handpose 模型
let predictions = []; // 儲存偵測結果
let isModelLoaded = false; // 模型是否載入完成
let consoleBuffer; // 新增：用於快取靜態外殼的畫布
let gridOffset = 0; // 新增：背景網格滾動偏移量
let ratHistory = []; // 新增：儲存老鼠移動路徑用於拖尾效果
let handIsOpenStatus = false; // 新增：判斷手掌是否張開 (比5)
let menuScrollX = 0; // 新增：選單捲動位置
let targetMenuScrollX = 0; // 新增：選單目標捲動位置
let bgParticles = []; // 新增：用於獲勝/失敗畫面的背景粒子

// 遊戲一專用變數
let score = 0;
let items = []; // 儲存掉落物 (起司、電擊等)
let particles = []; // 儲存噴射粒子
let stunTimer = 0; // 暈眩計時器
let flashTimer = 0; // 螢幕閃爍計時器
let gameSpeed = 3; // 基礎下落速度
let shakeTimer = 0; // 新增：畫面震動計時器
let scoreHistory = []; // 新增：儲存分數歷史紀錄
let hoverDuration = 0; // 新增：追蹤在按鈕上的停留時間
let triggerTime = 60;  // 新增：觸發時間（約 1 秒，假設 60 FPS）
let earWiggleTimer = 0; // 新增：耳朵縮放動畫計時器
let gameTimer = 60;    // 總遊戲時間 (秒)
let startTime;         // 紀錄開始時間
let finalTimeSpent = 0; // 最後花費的時間

function setup() {
  // 建立橫式全螢幕畫布
  createCanvas(windowWidth, windowHeight);
  
  // 初始化 WebCam
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide(); // 隱藏原始 HTML 標籤，我們要在畫布上自己畫

  // 初始化 Handpose (食指追蹤)
  handpose = ml5.handpose(video, modelReady);
  handpose.on('predict', function(results) {
    predictions = results;
  });

  // 初始化一些掉落物
  for(let i = 0; i < 5; i++) {
    items.push(new FallingItem());
  }

  // 初始化快取畫布
  createConsoleBuffer();
}

function modelReady() {
  console.log("手勢偵測模型準備好了！");
  isModelLoaded = true;
}

// 新增：繪製靜態外殼與背景到快取畫布
function createConsoleBuffer() {
  consoleBuffer = createGraphics(windowWidth, windowHeight);
  
  // === 1. 復古霓虹背景 ===
  consoleBuffer.clear(); // 改為透明背景，以便看見下層的動態網格

  // === 2. 掌上型電玩主機機身 ===
  let consoleW = width * 0.85;
  let consoleH = height * 0.85;
  let consoleX = (width - consoleW) / 2;
  let consoleY = (height - consoleH) / 2;

  // 主機外殼加上漸層感與邊框
  consoleBuffer.noStroke();
  consoleBuffer.fill(60, 65, 75); 
  consoleBuffer.rect(consoleX, consoleY, consoleW, consoleH, 20);
  
  consoleBuffer.stroke(80, 85, 95);
  consoleBuffer.strokeWeight(2);
  consoleBuffer.noFill();
  consoleBuffer.rect(consoleX + 5, consoleY + 5, consoleW - 10, consoleH - 10, 18);

  consoleBuffer.noStroke();
  consoleBuffer.fill(45, 50, 55);
  consoleBuffer.rect(consoleX, consoleY + consoleH - 15, consoleW, 15, 0, 0, 20, 20);

  consoleBuffer.fill(30, 30, 35);
  consoleBuffer.rect(width / 2 - 180, consoleY + 15, 360, 20, 5);

  // === 4. 螢幕外框 ===
  let screenW = consoleW * 0.65;
  let screenH = consoleH * 0.75;
  let screenX = consoleX + (consoleW * 0.05);
  let screenY = consoleY + (consoleH - screenH) / 2;

  // 螢幕外框發光效果
  consoleBuffer.drawingContext.shadowBlur = 20;
  consoleBuffer.drawingContext.shadowColor = 'rgba(0, 0, 0, 0.8)';
  consoleBuffer.fill(35, 35, 40);
  consoleBuffer.rect(screenX, screenY, screenW, screenH, 10);
  consoleBuffer.drawingContext.shadowBlur = 0;

  // 邊框裝飾線
  consoleBuffer.stroke(220, 50, 50); 
  consoleBuffer.strokeWeight(3);
  consoleBuffer.line(screenX + 20, screenY + 12, screenX + screenW - 20, screenY + 12);
  consoleBuffer.stroke(50, 100, 200); 
  consoleBuffer.line(screenX + 20, screenY + 19, screenX + screenW - 20, screenY + 19);

  // 遊戲區域底色
  consoleBuffer.noStroke();
  consoleBuffer.fill(15, 25, 20); 
  consoleBuffer.rect(screenX + 30, screenY + 40, screenW - 60, screenH - 70);

  // === 6. 右側與底部按鈕 ===
  let controlAreaX = screenX + screenW;
  let controlAreaW = consoleW - screenW - (consoleW * 0.1);
  let dpadX = controlAreaX + (controlAreaW * 0.35);
  let dpadY = screenY + (screenH * 0.3);
  
  consoleBuffer.fill(25, 25, 30);
  consoleBuffer.rect(dpadX - 15, dpadY - 45, 30, 90, 5);
  consoleBuffer.rect(dpadX - 45, dpadY - 15, 90, 30, 5);
  consoleBuffer.fill(40, 40, 45);
  consoleBuffer.ellipse(dpadX, dpadY, 15, 15);

  let btnY = screenY + (screenH * 0.65);
  let btnX_A = controlAreaX + (controlAreaW * 0.75);
  let btnX_B = controlAreaX + (controlAreaW * 0.5);
  consoleBuffer.fill(20, 20, 25);
  consoleBuffer.ellipse(btnX_B + 2, btnY + 14, 40, 40);
  consoleBuffer.ellipse(btnX_A + 2, btnY + 4, 40, 40);
  consoleBuffer.fill(200, 40, 40);
  consoleBuffer.ellipse(btnX_B, btnY + 10, 40, 40);
  consoleBuffer.ellipse(btnX_A, btnY, 40, 40);

  consoleBuffer.fill(180, 185, 195);
  consoleBuffer.textAlign(CENTER);
  consoleBuffer.textSize(14);
  consoleBuffer.text("B", btnX_B, btnY + 35);
  consoleBuffer.text("A", btnX_A, btnY + 25);

  let ssY = screenY + screenH - 30;
  consoleBuffer.fill(30, 30, 35);
  consoleBuffer.rect(controlAreaX + (controlAreaW * 0.35) - 25, ssY, 50, 12, 5);
  consoleBuffer.rect(controlAreaX + (controlAreaW * 0.65) - 25, ssY, 50, 12, 5);
}

function draw() {
  // 繪製背景底色
  background(20, 15, 30);

  // === 動態背景網格（營造穿梭虛擬空間感） ===
  gridOffset = (gridOffset + 0.8) % 40; // 控制滾動速度
  push();
  stroke(40, 30, 60);
  strokeWeight(1);
  // 為網格加入微弱的霓虹發光感
  drawingContext.shadowBlur = 10;
  drawingContext.shadowColor = 'rgba(0, 255, 100, 0.2)';
  
  for (let x = gridOffset - 40; x <= width; x += 40) {
    line(x, 0, x, height);
  }
  for (let y = gridOffset - 40; y <= height; y += 40) {
    line(0, y, width, y);
  }
  pop();

  // 1. 直接繪製快取好的靜態 UI
  image(consoleBuffer, 0, 0);

  // 2. 計算動態區域座標 (需與 Buffer 內的計算一致)
  let consoleW = width * 0.85;
  let consoleH = height * 0.85;
  let consoleX = (width - consoleW) / 2;
  let consoleY = (height - consoleH) / 2;
  let screenW = consoleW * 0.65;
  let screenH = consoleH * 0.75;
  let screenX = consoleX + (consoleW * 0.05);
  let screenY = consoleY + (consoleH - screenH) / 2;
  let playAreaX = screenX + 30;
  let playAreaY = screenY + 40;
  let playAreaW = screenW - 60;
  let playAreaH = screenH - 70;

  // === [新增] 繪製視訊畫面於螢幕區 ===
  push();
  // 將畫筆移到螢幕區，並做鏡像翻轉（讓左手動，畫面老鼠也往左動）
  translate(playAreaX + playAreaW, playAreaY);
  scale(-1, 1); 
  tint(40, 100, 60, 180); // 調低 RGB 數值使畫面變暗，增加對比度
  image(video, 0, 0, playAreaW, playAreaH);
  pop();

  // === [新增] 讀取食指位置並平滑化 ===
  if (predictions.length > 0) {
    // 取得偵測信心最高的結果
    let hand = predictions[0]; 
    
    // 只有當偵測信心高於 0.8 時才更新座標，避免模型誤判其他手指
    if (hand.handInViewConfidence > 0.8) {
      let indexTip = hand.annotations.indexFinger[3];
      let targetX = map(indexTip[0], 0, 640, width, 0);
      let targetY = map(indexTip[1], 0, 480, 0, height);
      
      // 平滑化移動
      mouseX_pos = mouseX_pos + (targetX - mouseX_pos) * 0.2;
      mouseY_pos = mouseY_pos + (targetY - mouseY_pos) * 0.2;

      // 偵測手掌是否張開
      handIsOpenStatus = checkHandOpen(hand);
    }
  } else {
    if (!video) { mouseX_pos = mouseX; mouseY_pos = mouseY; }
  }

  // === 場景控制 ===
  if (!isModelLoaded) {
    drawLoadingScreen(playAreaX, playAreaY, playAreaW, playAreaH);
  } else if (currentScene === 0) {
    drawMenu(playAreaX, playAreaY, playAreaW, playAreaH);
  } else if (currentScene === 4) {
    drawIntro(playAreaX, playAreaY, playAreaW, playAreaH);
  } else if (currentScene === 1) {
    runMouseGame(playAreaX, playAreaY, playAreaW, playAreaH);
  } else if (currentScene === 5) {
    drawCalibration(playAreaX, playAreaY, playAreaW, playAreaH);
  } else if (currentScene === 2) {
    drawGameOver(playAreaX, playAreaY, playAreaW, playAreaH);
  } else if (currentScene === 3) {
    drawWinScene(playAreaX, playAreaY, playAreaW, playAreaH);
  }

  // 模擬 CRT 螢幕微弱的掃描線特效
  stroke(0, 255, 100, 15); // 綠色透明線條
  strokeWeight(2);
  for (let sY = playAreaY; sY < playAreaY + playAreaH; sY += 6) {
    line(playAreaX, sY, playAreaX + playAreaW, sY);
  }
}

// 當瀏覽器視窗大小改變時，畫布自動縮放維持全螢幕
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  createConsoleBuffer(); // 重大變更：視窗縮放後必須重新建立緩衝
}

// === 遊戲一：行為主義老鼠迷宮邏輯 ===
function runMouseGame(px, py, pw, ph) {
  // 0. 處理畫面震動效果
  push(); 
  if (shakeTimer > 0) {
    let intensity = 5; // 震動強度
    translate(random(-intensity, intensity), random(-intensity, intensity));
    shakeTimer--;
  }

  // 0.5 處理倒數計時
  let elapsed = (millis() - startTime) / 1000;
  let remaining = max(0, gameTimer - elapsed);
  finalTimeSpent = elapsed.toFixed(1);

  if (remaining <= 0) {
    scoreHistory.push(score);
    bgParticles = []; // 切換場景前清空粒子
    currentScene = 2; // 時間到，實驗終止
    return;
  }

  // 1. 限制老鼠座標在 playArea 內 (Constrain)
  let ratX = constrain(mouseX_pos, px + 30, px + pw - 30);
  let ratY = constrain(mouseY_pos, py + 25, py + ph - 25);

  // 2. 處理暈眩與速度 (懲罰機制)
  let currentMoveSpeed = gameSpeed;
  if (stunTimer > 0) {
    fill(255, 255, 255, 150);
    textAlign(CENTER);
    text("暈眩中！", ratX, ratY - 45);
    stunTimer--;
    currentMoveSpeed = 1; // 速度減慢
  }

  // 2.5 紀錄分數歷史 (每 30 幀紀錄一次，約 0.5 秒)
  if (frameCount % 30 === 0) {
    scoreHistory.push(score);
  }

  // 2.7 更新老鼠軌跡紀錄 (儲存最近 12 個位置)
  ratHistory.push({x: ratX, y: ratY});
  if (ratHistory.length > 12) ratHistory.shift();
  drawRatTrail(); // 繪製霓虹拖尾

  // 3. 更新與顯示掉落物 (OOP)
  for (let i = items.length - 1; i >= 0; i--) {
    items[i].update(currentMoveSpeed, py, ph);
    items[i].display();

    // 4. 碰撞偵測 (dist)
    if (dist(ratX, ratY, items[i].x, items[i].y) < 45) {
      handleCollision(items[i]);
      items[i].reset(py); // 撞到後重新從頂部掉落
    }
  }

  // 5. 繪製主角：像素小白鼠
  drawRat(ratX, ratY);

  // 6. 繪製粒子效果 (正向增強)
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].display();
    if (particles[i].alpha <= 0) particles.splice(i, 1);
  }

  // 7. 懲罰視覺效果：黑白閃爍
  if (flashTimer > 0) {
    fill(255, 255, 255, 150);
    rect(px, py, pw, ph);
    flashTimer--;
  }

  // 8. 顯示 UI
  fill(0, 255, 100);
  textAlign(LEFT, TOP);
  textSize(24); // 增大分數文字
  text("實驗得分: " + score + " / 100", px + 20, py + 15);
  
  // 顯示剩餘時間
  textAlign(RIGHT, TOP);
  text("剩餘時間: " + remaining.toFixed(1) + "s", px + pw - 20, py + 15);

  pop(); // 結束震動效果的 push()
}

function handleCollision(item) {
  if (item.type === "cheese") {
    score += 10;
    shakeTimer = 10; // 觸發畫面震動（約 0.16 秒）
    // 如果瀏覽器支援震動 API，則震動 50 毫秒
    if (navigator.vibrate) navigator.vibrate(50);

    earWiggleTimer = 20; // 吃到起司時，耳朵開始動 20 幀
    
    if (score >= 100) {
      bgParticles = []; // 切換場景前清空粒子
      currentScene = 3; // 達到100分獲勝！
    }

    // 觸發金幣噴射 (正向增強)
    for (let i = 0; i < 10; i++) {
      particles.push(new Particle(item.x, item.y, color(255, 200, 0)));
    }
  } else if (item.type === "shock") {
    score = max(0, score - 5);
    stunTimer = 60; // 暈眩約 1 秒
    flashTimer = 10; // 閃爍
    if (score <= 0) {
      scoreHistory.push(0); // 紀錄最後的失敗點
      bgParticles = []; // 切換場景前清空粒子
      currentScene = 2; // 分數扣光，切換到 Game Over
    }
  }
}

// === 小白鼠繪製元件 ===
function drawRat(x, y) {
  push();
  translate(x, y);
  
  // 1. 尾巴 (細長且彎曲的粉紅尾巴)
  noFill();
  stroke(255, 180, 180);
  strokeWeight(2);
  line(-25, 0, -42, 8);
  line(-42, 8, -50, 0);

  // 2. 身體 (更流線型的白色橢圓)
  noStroke();
  fill(240); // 白色身體
  ellipse(0, 0, 55, 35); 
  
  // 3. 耳朵 (一左一右的大圓粉紅耳朵)
  fill(255, 200, 200);
  let earSize = 18;
  // 如果計時器大於 0，耳朵產生縮放動畫
  if (earWiggleTimer > 0) {
    earSize = 18 + sin(frameCount * 0.8) * 8; 
    earWiggleTimer--; // 每次繪製遞減計時器
  }
  ellipse(-5, -14, earSize, earSize); 
  ellipse(-5, 14, earSize, earSize);
  
  // 4. 眼睛 (修正：現在有對稱的兩隻黑眼睛)
  fill(0); 
  ellipse(16, -6, 5, 5); 
  ellipse(16, 6, 5, 5); 
  
  // 5. 鼻子 (前端明顯的粉紅鼻尖)
  fill(255, 150, 150);
  ellipse(28, 0, 8, 8);

  // 6. 鬍鬚 (增加細節感)
  stroke(120);
  strokeWeight(1);
  line(22, 0, 36, -6);
  line(22, 0, 36, 6);

  pop();
}

// === 掉落物類別 (Class) ===
class FallingItem {
  constructor() {
    // 這裡要注意：x 必須限制在 playArea 的全域座標內
    // 因為建構時還沒拿到 playArea 的值，我們先在 reset 裡處理
    this.reset(-100); 
  }

  reset(topY) {
    // 假設螢幕寬度約為 width*0.85*0.65，這裡直接用一個安全範圍
    let safeXStart = width * 0.2; 
    let safeXEnd = width * 0.6;
    this.x = random(safeXStart, safeXEnd);
    this.y = topY - random(50, 500);
    this.type = random(["cheese", "cheese", "shock"]); // 2/3 機率是起司
  }

  update(speed, topLimit, heightLimit) {
    this.y += speed;
    if (this.y > topLimit + heightLimit) {
      this.reset(topLimit);
    }
  }

  display() {
    noStroke();
    if (this.type === "cheese") {
      fill(255, 200, 0); // 黃色三角形起司
      triangle(this.x, this.y - 18, this.x - 18, this.y + 18, this.x + 18, this.y + 18); // 放大起司
    } else {
      fill(100, 100, 255); // 藍色電擊泡泡
      ellipse(this.x, this.y, 40, 40); // 放大電擊
      stroke(255);
      line(this.x - 10, this.y - 10, this.x + 10, this.y + 10); // 放大內部的閃電線條
    }
  }
}

// === 噴射粒子類別 (Class) ===
class Particle {
  constructor(x, y, c) {
    this.x = x;
    this.y = y;
    this.vx = random(-2, 2);
    this.vy = random(-5, -1);
    this.color = c;
    this.alpha = 255;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= 10;
  }
  display() {
    fill(red(this.color), green(this.color), blue(this.color), this.alpha);
    noStroke();
    rect(this.x, this.y, 8, 8); // 稍微放大金幣粒子
  }
}

// === 重置遊戲狀態 ===
function resetGame() {
  score = 50; // 設定起始分數，讓玩家有扣分的空間
  stunTimer = 0;
  flashTimer = 0;
  shakeTimer = 0;
  handIsOpenStatus = false;
  ratHistory = []; // 重置軌跡紀錄
  earWiggleTimer = 0; // 重置動畫狀態
  bgParticles = []; // 清空背景粒子
  startTime = millis(); // 重新設定開始時間
  scoreHistory = [score]; 
  items = [];
  for(let i = 0; i < 5; i++) {
    items.push(new FallingItem());
  }
}

function drawMenu(px, py, pw, ph) {
  push();
  fill(0, 255, 100);
  drawingContext.shadowBlur = 15;
  drawingContext.shadowColor = 'rgba(0, 255, 100, 0.8)';
  textAlign(CENTER, CENTER);
  textSize(42); // 大幅度增加標題大小
  text("行為主義老鼠實驗", px + pw / 2, py + ph / 2 - 80);

  // 定義 START 按鈕的範圍
  let btnW = 240;
  let btnH = 65;
  let btnX = px + pw / 2 - btnW / 2;
  let btnY = py + ph / 2 + 10;

  // 檢查食指位置（mouseX_pos, mouseY_pos）是否在按鈕內
  let isHovering = mouseX_pos > btnX && mouseX_pos < btnX + btnW &&
                   mouseY_pos > btnY && mouseY_pos < btnY + btnH;

  if (isHovering) {
    hoverDuration++;
  } else {
    hoverDuration = max(0, hoverDuration - 2); // 沒指著時進度條會退回
  }

  // 繪製按鈕外框
  stroke(0, 255, 100);
  strokeWeight(2);
  noFill();
  rect(btnX, btnY, btnW, btnH, 10);

  // 繪製填充進度條（視覺回饋）
  noStroke();
  fill(0, 255, 100, 150);
  let progressW = map(min(hoverDuration, triggerTime), 0, triggerTime, 0, btnW);
  rect(btnX, btnY, progressW, btnH, 10);

  // 按鈕文字
  textSize(28); // 增加按鈕文字大小
  if (progressW > btnW / 2) fill(15, 25, 20); // 進度過半時文字變色
  else fill(0, 255, 100);
  text("開始實驗", px + pw / 2, btnY + btnH / 2);

  // 提示操作方式
  fill(0, 255, 100);
  textSize(16);
  text("☝️ 將食指移至此處並停留啟動", px + pw / 2, btnY + btnH + 40);
  
  // 繪製手勢游標
  drawGestureCursor();

  // 達到觸發時間就切換場景
  if (hoverDuration >= triggerTime) {
    score = 50; // 開始時的分數
    resetGame();
    targetMenuScrollX = 0; // 重置捲動位置
    menuScrollX = 0;
    currentScene = 6; // 進入遊戲選擇選單
    hoverDuration = 0;
  }
  pop();
}

// === 輔助：偵測手掌是否張開 (比5) ===
function checkHandOpen(hand) {
  if (!hand || !hand.annotations) return false;
  let wrist = hand.annotations.palmBase[0];
  let fingers = ["indexFinger", "middleFinger", "ringFinger", "pinky"];
  let extendedCount = 0;
  
  for (let f of fingers) {
    let fingerData = hand.annotations[f];
    let tip = fingerData[3];
    let mcp = fingerData[0];
    // 計算手指尖端到手腕的距離，若遠大於手指基部到手腕距離，代表手指伸直
    if (dist(tip[0], tip[1], wrist[0], wrist[1]) > dist(mcp[0], mcp[1], wrist[0], wrist[1]) * 1.4) {
      extendedCount++;
    }
  }
  return extendedCount >= 4; // 四根手指(不含大拇指)伸直即判定為張開
}

// === 新增：遊戲選擇選單 ===
function drawGameSelect(px, py, pw, ph) {
  push();
  // 背景粒子 (青色)
  manageBgParticles(px, py, pw, ph, color(0, 255, 255));

  fill(0, 255, 255);
  textAlign(CENTER, TOP);
  textSize(36);
  text("選擇實驗項目", px + pw / 2, py + 40);

  // === 左右滑動偵測邏輯 ===
  // 當食指靠近左邊 20% 或右邊 20% 時觸發捲動
  if (mouseX_pos > px && mouseX_pos < px + pw * 0.2) {
    targetMenuScrollX += 10;
  } else if (mouseX_pos > px + pw * 0.8 && mouseX_pos < px + pw) {
    targetMenuScrollX -= 10;
  }
  
  // 限制捲動範圍 (根據卡片數量動態調整)
  let maxScroll = -(260 * 4 - pw + 100); 
  targetMenuScrollX = constrain(targetMenuScrollX, maxScroll, 0);
  // 平滑插值動畫 (lerp)
  menuScrollX = lerp(menuScrollX, targetMenuScrollX, 0.1);

  // 底部捲動提示
  fill(0, 255, 255, 100);
  textSize(16);
  text("<< 左右邊緣滑動 | 停留並張開手掌 (🖐️) 以啟動實驗 >>", px + pw / 2, py + ph - 25);

  // 遊戲卡片設定
  let cardW = 220;
  let cardH = 280;
  let cardY = py + ph / 2 - cardH / 2 + 30;
  let gap = 260; // 卡片間距

  // 檢查是否沒有任何卡片被指著，若無則緩慢重置進度
  let anyHover = false;
  // (此處邏輯會在 drawGameCard 內更新 anyHover)
  
  // 繪製多個遊戲卡片 (加入 menuScrollX 偏移量)
  drawGameCard(px + 60 + menuScrollX, cardY, cardW, cardH, "行為小鼠", "正向增強與懲罰實驗", color(0, 255, 100), 4, px, pw);
  drawGameCard(px + 60 + gap + menuScrollX, cardY, cardW, cardH, "反應訓練", "刺激感官反應速度", color(255, 150, 0), -1, px, pw);
  drawGameCard(px + 60 + gap * 2 + menuScrollX, cardY, cardW, cardH, "記憶測試", "短期圖像記憶實驗", color(255, 0, 255), -1, px, pw);
  drawGameCard(px + 60 + gap * 3 + menuScrollX, cardY, cardW, cardH, "邏輯迷宮", "高階認知運作測量", color(0, 200, 255), -1, px, pw);

  drawGestureCursor();
  pop();
}

// 輔助函數：繪製遊戲卡片
function drawGameCard(x, y, w, h, title, desc, col, targetScene, px, pw) {
  // 檢查卡片是否在顯示區域內，若超出範圍則不處理碰撞且半透明
  let isVisible = x + w > px && x < px + pw;
  if (!isVisible) return; 

  let isHover = mouseX_pos > x && mouseX_pos < x + w && 
                mouseY_pos > y && mouseY_pos < y + h &&
                mouseX_pos > px && mouseX_pos < px + pw; // 額外判斷是否在遊戲區內
  
  push();
  let currentStrokeWeight = 2;

  if (isHover) {
    translate(-5, -5); // 稍微向上浮動
    w += 10; h += 10;
    drawingContext.shadowBlur = 20;
    drawingContext.shadowColor = col;
    
    // 只有在手掌張開時才累積進度
    if (handIsOpenStatus) {
      hoverDuration++;
      // 呼吸燈效果：利用 sin 函數產生 0~1 的循環數值
      let pulse = (sin(frameCount * 0.15) + 1) / 2;
      drawingContext.shadowBlur = 20 + pulse * 20; // 發光範圍呼吸
      drawingContext.shadowColor = col;
      currentStrokeWeight = 4 + pulse * 6; // 邊框粗細呼吸
    } else {
      drawingContext.shadowBlur = 20;
      drawingContext.shadowColor = col;
      currentStrokeWeight = 4;

      // 提示玩家張開手掌
      fill(255, 255, 255);
      textSize(18);
      textAlign(CENTER);
      text("🖐️ 請張開手掌確認", x + w/2, y + h/2 + 20);
      hoverDuration = max(0, hoverDuration - 1);
    }
  }

  // 卡片背景
  fill(30, 35, 40);
  stroke(isHover ? col : 100);
  strokeWeight(isHover ? 4 : 2);
  strokeWeight(currentStrokeWeight);
  rect(x, y, w, h, 15);

  // 卡片內容
  noStroke();
  fill(col);
  textAlign(CENTER);
  textSize(24);
  text(title, x + w / 2, y + 50);
  
  fill(255);
  textSize(14);
  text(desc, x + w / 2, y + h - 40);

  // 繪製選擇進度條
  if (isHover && targetScene !== -1) {
    fill(col);
    let progressH = map(min(hoverDuration, triggerTime), 0, triggerTime, 0, 10);
    rect(x, y + h - 10, w, progressH, 0, 0, 15, 15);
    
    if (hoverDuration >= triggerTime) {
      currentScene = targetScene;
      hoverDuration = 0;
    }
  }
  pop();
}

// === 遊戲結束畫面 ===
function drawGameOver(px, py, pw, ph) {
  push();
  // 背景粒子飄散效果 (紅色)
  manageBgParticles(px, py, pw, ph, color(255, 50, 50));

  fill(255, 50, 50); // 紅色警告色
  drawingContext.shadowBlur = 15;
  drawingContext.shadowColor = 'rgba(255, 50, 50, 0.8)';
  textAlign(CENTER, CENTER);
  textSize(54); // 增大結束標題
  text("實驗終止", px + pw / 2, py + ph / 2 - 100);

  fill(255, 255, 255);
  textSize(20);
  text("總耗時: " + finalTimeSpent + " 秒", px + pw / 2, py + ph / 2 - 45);

  // 繪製學習曲線圖表
  drawScoreChart(px, py, pw, ph);

  // 繪製科普內容
  drawTheoryPop(px, py, pw, ph, "失敗");

  // Restart 按鈕
  let btnW = 200;
  let btnH = 60;
  let btnX = px + pw / 2 - btnW / 2;
  let btnY = py + ph / 2 + 20;

  let isHovering = mouseX_pos > btnX && mouseX_pos < btnX + btnW &&
                   mouseY_pos > btnY && mouseY_pos < btnY + btnH;

  if (isHovering) {
    hoverDuration++;
  } else {
    hoverDuration = max(0, hoverDuration - 2);
  }

  stroke(255, 50, 50);
  strokeWeight(2);
  noFill();
  rect(btnX, btnY, btnW, btnH, 10);

  noStroke();
  fill(255, 50, 50, 150);
  let progressW = map(min(hoverDuration, triggerTime), 0, triggerTime, 0, btnW);
  rect(btnX, btnY, progressW, btnH, 10);

  textSize(24);
  fill(255, 50, 50);
  if (progressW > btnW / 2) fill(15, 25, 20);
  text("重新嘗試", px + pw / 2, btnY + btnH / 2);

  // 手勢游標
  drawGestureCursor();

  if (hoverDuration >= triggerTime) {
    resetGame();
    currentScene = 1;
    hoverDuration = 0;
  }
  pop();
}

// === 遊戲勝利畫面 ===
function drawWinScene(px, py, pw, ph) {
  push();
  // 背景粒子飄散效果 (金色)
  manageBgParticles(px, py, pw, ph, color(255, 255, 0));

  fill(255, 255, 0); // 勝利金色
  drawingContext.shadowBlur = 20;
  drawingContext.shadowColor = 'rgba(255, 255, 0, 0.6)';
  textAlign(CENTER, CENTER);
  textSize(54); // 增大勝利標題
  text("實驗成功！", px + pw / 2, py + ph / 2 - 100);
  
  fill(255, 255, 255);
  textSize(20);
  text("總耗時: " + finalTimeSpent + " 秒", px + pw / 2, py + ph / 2 - 45);

  // 繪製學習曲線
  drawScoreChart(px, py, pw, ph);

  // 繪製科普內容
  drawTheoryPop(px, py, pw, ph, "成功");

  // Play Again 按鈕
  let btnW = 220;
  let btnH = 60;
  let btnX = px + pw / 2 - btnW / 2;
  let btnY = py + ph / 2 + 20;

  let isHovering = mouseX_pos > btnX && mouseX_pos < btnX + btnW &&
                   mouseY_pos > btnY && mouseY_pos < btnY + btnH;

  if (isHovering) hoverDuration++;
  else hoverDuration = max(0, hoverDuration - 2);

  stroke(255, 255, 0);
  strokeWeight(2);
  noFill();
  rect(btnX, btnY, btnW, btnH, 10);

  noStroke();
  fill(255, 255, 0, 150);
  let progressW = map(min(hoverDuration, triggerTime), 0, triggerTime, 0, btnW);
  rect(btnX, btnY, progressW, btnH, 10);

  textSize(24);
  fill(255, 255, 0);
  if (progressW > btnW / 2) fill(15, 25, 20);
  text("新的回合", px + pw / 2, btnY + btnH / 2);

  drawGestureCursor();

  if (hoverDuration >= triggerTime) {
    score = 50;
    resetGame();
    currentScene = 0; // 回主選單
    hoverDuration = 0;
  }
  pop();
}

// === 實驗介紹與規則畫面 ===
function drawIntro(px, py, pw, ph) {
  push();

  // 0. 加入受試生物預覽動畫 (8-bit 小老鼠)
  let previewX = px + pw - 110;
  let previewY = py + 175;
  
  // 繪製預覽框
  noFill();
  stroke(0, 255, 100, 100);
  rect(px + pw - 175, py + 95, 130, 150, 5);
  fill(0, 255, 100, 150);
  textSize(10);
  textAlign(LEFT, TOP);
  text("[ 受試生物預覽 ]", px + pw - 165, py + 105);

  // 讓老鼠在框內上下跳動，模擬生動的呼吸與動作
  drawRat(previewX, previewY + sin(frameCount * 0.1) * 8);

  // 1. 頂部系統路徑與檔案資訊
  fill(0, 255, 100);
  textAlign(LEFT, TOP);
  textSize(12);
  text("DIRECTORY: C:\\PROJECT_MAZE\\THEORY\\", px + 25, py + 25);
  text("FILE: RESEARCH_LOG_v1.0.txt", px + 25, py + 40);

  stroke(0, 255, 100, 100);
  strokeWeight(1);
  line(px + 20, py + 55, px + pw - 20, py + 55); // 分隔線

  // 行為主義內容介紹
  noStroke();
  textAlign(LEFT);
  let lineH = 26; // 增加行高
  let textX = px + 35;
  let textY = py + 70;

  // 第一部分：理論 (使用青色強調)
  fill(0, 255, 255); 
  textSize(24);
  text("[ 核心理論：行為主義 ]", textX, textY);
  fill(255, 255, 255); 
  textSize(20);
  text("> 正向增強：起司獎勵 (誘發導航行為)", textX + 15, textY + lineH + 10);
  text("> 懲罰機制：電擊泡泡 (抑制錯誤反應)", textX + 15, textY + lineH * 2 + 10);

  // 第二部分：參數 (使用洋紅色強調)
  fill(255, 0, 255); 
  textSize(24);
  text("[ 實驗參數設定 ]", textX, textY + lineH * 4.5);
  fill(255, 255, 255); 
  textSize(20);
  text("- 目標：100 分 (完成制約)", textX + 15, textY + lineH * 5.5 + 10);
  text("- 終止：低於 0 分 (效能歸零)", textX + 15, textY + lineH * 6.5 + 10);
  text("- 輸入：食指影像追蹤系統", textX + 15, textY + lineH * 7.5 + 10);

  // START 按鈕
  let btnW = 200;
  let btnH = 55;
  let btnX = px + pw / 2 - btnW / 2;
  let btnY = py + ph - 80;

  let isHovering = mouseX_pos > btnX && mouseX_pos < btnX + btnW &&
                   mouseY_pos > btnY && mouseY_pos < btnY + btnH;

  if (isHovering) {
    hoverDuration++;
  } else {
    hoverDuration = max(0, hoverDuration - 2);
  }

  // 按鈕視覺
  stroke(0, 255, 100);
  strokeWeight(2);
  noFill();
  rect(btnX, btnY, btnW, btnH, 8);

  noStroke();
  fill(0, 255, 100, 150);
  let progressW = map(min(hoverDuration, triggerTime), 0, triggerTime, 0, btnW);
  rect(btnX, btnY, progressW, btnH, 8);

  textAlign(CENTER, CENTER);
  textSize(18);
  if (progressW > btnW / 2) fill(15, 25, 20);
  else fill(0, 255, 100);
  text("執行程序", px + pw / 2, btnY + btnH / 2);

  drawGestureCursor();

  if (hoverDuration >= triggerTime) {
    currentScene = 5; // 進入校準畫面
    hoverDuration = 0;
  }
  pop();
}

// === 輔助：手勢偵測狀態顯示 ===
function drawHandStatus(px, py, pw) {
  push();
  let isDetected = predictions.length > 0;
  let statusColor = isDetected ? color(0, 255, 0) : color(255, 0, 0);
  
  // 指示燈
  fill(statusColor);
  noStroke();
  ellipse(px + pw - 20, py + 20, 10, 10);
  
  // 文字提示
  textAlign(RIGHT);
  textSize(10);
  let statusMsg = "未偵測到手部 - 請面向鏡頭";
  if (isDetected) {
    statusMsg = handIsOpenStatus ? "🖐️ 手勢模式：確認選擇" : "☝️ 手勢模式：移動游標";
  }
  text(statusMsg, px + pw - 35, py + 24);
  pop();
}

// === 輔助：通用的手勢游標 ===
function drawGestureCursor() {
  push();
  noStroke();
  fill(255, 255, 255, 100);
  ellipse(mouseX_pos, mouseY_pos, 25, 25); // 外圈
  fill(0, 255, 100);
  ellipse(mouseX_pos, mouseY_pos, 5, 5); // 中心點
  pop();
}

// === 繪製學習曲線小圖表 ===
function drawScoreChart(px, py, pw, ph) {
  let chartX = px + 60;
  let chartY = py + ph - 60; // 置於底部
  let chartW = pw - 120;
  let chartH = 60;

  // 繪製圖表背景與標題
  fill(0, 255, 100, 50);
  textSize(10);
  textAlign(LEFT);
  text("學習曲線 (分數隨時間變化趨勢)", chartX, chartY - chartH - 10);

  // 繪製座標軸
  stroke(0, 255, 100, 100);
  strokeWeight(1);
  line(chartX, chartY, chartX + chartW, chartY); // X 軸
  line(chartX, chartY, chartX, chartY - chartH); // Y 軸

  // 繪製折線圖
  if (scoreHistory.length > 1) {
    // 1. 找出最高分及其在陣列中的索引
    let maxScore = -1;
    let maxIndex = -1;
    for (let i = 0; i < scoreHistory.length; i++) {
      if (scoreHistory[i] >= maxScore) {
        maxScore = scoreHistory[i];
        maxIndex = i;
      }
    }

    // 1.5 計算動態 Y 軸上限值：最高分加上 20% 的緩衝空間，且至少為 100
    let yLimit = max(maxScore * 1.2, 100);

    noFill();
    stroke(0, 255, 100);
    strokeWeight(2);
    beginShape();
    let starX, starY; // 用來儲存最高點的座標
    for (let i = 0; i < scoreHistory.length; i++) {
      // map(當前值, 原始範圍小, 原始範圍大, 目標範圍小, 目標範圍大)
      let x = map(i, 0, scoreHistory.length - 1, chartX, chartX + chartW);
      let y = map(scoreHistory[i], 0, yLimit, chartY, chartY - chartH); // 使用動態上限
      vertex(x, y);

      // 如果是最高點，記住座標
      if (i === maxIndex) {
        starX = x;
        starY = y;
      }
    }
    endShape();

    // 2. 在最高點畫一個閃爍的黃色星號 (利用 frameCount 控制閃爍)
    if (maxIndex !== -1 && floor(frameCount / 15) % 2 === 0) {
      push();
      translate(starX, starY);
      fill(255, 255, 0); // 經典黃色
      noStroke();
      // 使用兩個反向三角形拼成一個 8-bit 星號
      triangle(-8, 5, 8, 5, 0, -10);
      triangle(-8, -5, 8, -5, 0, 10);
      
      // 在星號上方標註最高分數
      textAlign(CENTER);
      textSize(10);
      text("最高分: " + maxScore, 0, -15);
      pop();
    }
  }
}

// === 新增：繪製老鼠的霓虹拖尾 ===
function drawRatTrail() {
  for (let i = 0; i < ratHistory.length; i++) {
    let pos = ratHistory[i];
    // 越舊的位置透明度越低，尺寸越小
    let opacity = map(i, 0, ratHistory.length, 0, 100);
    let sizeScale = map(i, 0, ratHistory.length, 0.4, 0.9);
    
    push();
    noStroke();
    fill(0, 255, 100, opacity);
    // 為拖尾加上霓虹發光感
    drawingContext.shadowBlur = 15;
    drawingContext.shadowColor = 'rgba(0, 255, 100, 0.5)';
    // 繪製簡化的老鼠身體作為殘影
    ellipse(pos.x, pos.y, 55 * sizeScale, 35 * sizeScale);
    pop();
  }
}

// === 載入畫面邏輯 ===
function drawLoadingScreen(px, py, pw, ph) {
  push();
  fill(0, 255, 100);
  textAlign(CENTER, CENTER);
  textSize(20);
  
  // 動態點點效果，增加「正在運算」的感覺
  let dotCount = floor(frameCount / 20) % 4;
  let dots = "";
  for (let i = 0; i < dotCount; i++) dots += ".";
  text("人工智慧系統初始化中" + dots, px + pw / 2, py + ph / 2 - 20);
  
  // 繪製復古進度條外框
  stroke(0, 255, 100);
  strokeWeight(2);
  noFill();
  rect(px + pw / 2 - 100, py + ph / 2 + 20, 200, 20);
  
  // 繪製進度條填充 (循環掃描動畫)
  noStroke();
  fill(0, 255, 100, 150);
  let barWidth = (frameCount * 3) % 200;
  rect(px + pw / 2 - 100, py + ph / 2 + 20, barWidth, 20);
  pop();
}

// === 新增：行為主義科普區 ===
function drawTheoryPop(px, py, pw, ph, status) {
  push();
  let boxX = px + 40;
  let boxY = py + 80;
  let boxW = pw - 80;
  let boxH = 160;
  
  fill(15, 25, 20, 200);
  stroke(0, 255, 100, 150);
  rect(boxX, boxY, boxW, boxH, 10);
  
  noStroke();
  fill(255, 255, 0);
  textSize(18);
  textAlign(LEFT, TOP);
  
  // 科普標題
  let title = "【科普：行為主義與你的實驗】";
  text(title, boxX + 15, boxY + 15);
  
  fill(255, 255, 255);
  textSize(18); // 大幅增加科普文字大小
  let info = status === "成功" ? 
    "恭喜！你成功透過「正向增強」(起司) 建立了穩定的行為反應。\n這模擬了心理學家 Skinner 的實驗：個體學會了透過操作環境來獲得獎勵。\n下方的學習曲線反映了你建立行為連結的效率。" : 
    "實驗數據顯示行為建立受阻。在理論中，「懲罰」(電擊) 雖然能抑制錯誤，\n但過強的負向刺激可能導致個體產生逃避反應。觀察下方的曲線，\n分數的波動代表了刺激與反應之間的連結尚未穩固。";

  text(info, boxX + 15, boxY + 50, boxW - 30);
  pop();
}

// === 背景飄散粒子管理 ===
function manageBgParticles(px, py, pw, ph, col) {
  if (bgParticles.length < 60) {
    bgParticles.push(new BgParticle(px, py, pw, ph, col));
  }
  for (let p of bgParticles) {
    p.update();
    p.display();
  }
}

// === 背景飄散粒子類別 ===
class BgParticle {
  constructor(px, py, pw, ph, c) {
    this.px = px; this.py = py; this.pw = pw; this.ph = ph;
    this.x = random(px, px + pw);
    this.y = random(py, py + ph);
    this.speed = random(0.3, 1.2);
    this.size = random(3, 8);
    this.c = c;
    this.alpha = random(30, 120);
  }
  update() {
    this.y -= this.speed;
    if (this.y < this.py) {
      this.y = this.py + this.ph;
      this.x = random(this.px, this.px + this.pw);
    }
  }
  display() {
    noStroke();
    let fillCol = color(red(this.c), green(this.c), blue(this.c), this.alpha);
    fill(fillCol);
    rect(this.x, this.y, this.size, this.size);
  }
}

// === 新增：手勢校準畫面 ===
function drawCalibration(px, py, pw, ph) {
  push();
  // 背景粒子 (青色)
  manageBgParticles(px, py, pw, ph, color(0, 255, 255));

  fill(0, 255, 255);
  textAlign(CENTER, TOP);
  textSize(32);
  text("系統校準中...", px + pw / 2, py + 40);
  
  fill(255);
  textSize(18);
  text("請將食指移動到下方準星中心，並停留 1.5 秒", px + pw / 2, py + 85);
  text("確保光線充足且手掌正對鏡頭", px + pw / 2, py + 110);

  // 繪製校準準星
  let targetX = px + pw / 2;
  let targetY = py + ph / 2 + 40;
  let targetSize = 100;

  // 準星外圈
  stroke(0, 255, 255, 150);
  strokeWeight(2);
  noFill();
  ellipse(targetX, targetY, targetSize, targetSize);
  line(targetX - targetSize/2 - 10, targetY, targetX + targetSize/2 + 10, targetY);
  line(targetX, targetY - targetSize/2 - 10, targetX, targetY + targetSize/2 + 10);

  // 如果 AI 偵測不到手，在準星中間顯示警告
  if (predictions.length === 0) {
    push();
    fill(255, 50, 50, floor(frameCount / 10) % 2 === 0 ? 255 : 100); // 閃爍效果
    noStroke();
    textSize(16);
    textAlign(CENTER, CENTER);
    text("⚠️\n找不到手部", targetX, targetY);
    pop();
  }

  // 檢查是否在準星內
  let d = dist(mouseX_pos, mouseY_pos, targetX, targetY);
  let triggerCalibration = 90; // 需要停留約 1.5 秒 (90幀)
  
  // 只有在偵測到手部且對準中心時才增加校準進度
  if (d < targetSize / 2 && predictions.length > 0) {
    hoverDuration++;
    fill(0, 255, 255, 100);
    noStroke();
    // 繪製填充進度 (圓形填充)
    let fillSize = map(min(hoverDuration, triggerCalibration), 0, triggerCalibration, 0, targetSize);
    ellipse(targetX, targetY, fillSize, fillSize);
  } else {
    hoverDuration = max(0, hoverDuration - 1);
  }

  // 提示文字
  fill(0, 255, 255);
  textSize(24);
  text(floor(map(min(hoverDuration, triggerCalibration), 0, triggerCalibration, 0, 100)) + "%", targetX, targetY + targetSize/2 + 40);

  drawGestureCursor();

  if (hoverDuration >= triggerCalibration) {
    currentScene = 1; // 校準完成，進入遊戲
    hoverDuration = 0;
  }
  pop();
}

// === 輔助：偵測手掌是否張開 (比5) ===
function checkHandOpen(hand) {
  if (!hand || !hand.annotations) return false;
  let wrist = hand.annotations.palmBase[0];
  let fingers = ["indexFinger", "middleFinger", "ringFinger", "pinky"];
  let extendedCount = 0;
  
  for (let f of fingers) {
    let fingerData = hand.annotations[f];
    let tip = fingerData[3];
    let mcp = fingerData[0];
    // 判斷指尖到手腕距離是否顯著大於關節到手腕距離
    if (dist(tip[0], tip[1], wrist[0], wrist[1]) > dist(mcp[0], mcp[1], wrist[0], wrist[1]) * 1.35) {
      extendedCount++;
    }
  }
  return extendedCount >= 3; // 只要有三根手指伸直即判定為張開 (容錯性較高)
}
