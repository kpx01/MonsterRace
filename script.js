// DOM要素の取得
const display = document.getElementById('display');
const incrementBtn = document.getElementById('increment');
const decrementBtn = document.getElementById('decrement');
const resetBtn = document.getElementById('reset');

// カウンターの状態管理
let count = 0;

// 表示を更新する関数
function updateDisplay() {
    display.textContent = count;
    
    // 値によって色を変えるなどの視覚的な演出
    if (count > 0) {
        display.style.color = '#4a90e2';
    } else if (count < 0) {
        display.style.color = '#e74c3c';
    } else {
        display.style.color = '#333';
    }
}

// イベントリスナーの登録
incrementBtn.addEventListener('click', () => {
    count++;
    updateDisplay();
});

decrementBtn.addEventListener('click', () => {
    count--;
    updateDisplay();
});

resetBtn.addEventListener('click', () => {
    count = 0;
    updateDisplay();
});
