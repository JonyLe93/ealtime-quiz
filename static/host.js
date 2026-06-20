let socket = null;
let roomState = "LOBBY";
let totalQuestions = 15;
let currentQuestionIndex = -1;
let players = [];
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// Elements
const views = {
    lobby: document.getElementById("host-lobby"),
    question: document.getElementById("host-question"),
    reveal: document.getElementById("host-reveal"),
    finished: document.getElementById("host-finished"),
    error: document.getElementById("host-error")
};

const sidebarLeaderboardEmpty = document.getElementById("sidebar-leaderboard-empty");
const sidebarLeaderboardList = document.getElementById("sidebar-leaderboard-list");

// Initialize on load
window.addEventListener("DOMContentLoaded", () => {
    connectWebSocket();
    generateJoinQR();
});

function generateJoinQR() {
    const qrContainer = document.getElementById("qrcode");
    const joinUrlEl = document.getElementById("lobby-join-url");
    if (!qrContainer || !joinUrlEl) return;
    
    // Get player join URL: replace "/host" with "/"
    const joinUrl = window.location.href.replace(/\/host\/?$/, "") + "/";
    joinUrlEl.textContent = joinUrl;
    
    qrContainer.innerHTML = "";
    try {
        new QRCode(qrContainer, {
            text: joinUrl,
            width: 130,
            height: 130,
            colorDark: "#121240",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    } catch (e) {
        console.error("QRCode library failed to load:", e);
        qrContainer.style.background = "rgba(255, 255, 255, 0.05)";
        qrContainer.innerHTML = "<p style='font-size: 0.75rem; color: var(--text-muted); text-align: center; padding: 10px; line-height: 1.3;'>Không thể tải QR.<br>Vui lòng chia sẻ liên kết bên dưới.</p>";
    }
}

function showView(viewId) {
    Object.keys(views).forEach(key => {
        if (key === viewId) {
            views[key].classList.add("active");
        } else {
            views[key].classList.remove("active");
        }
    });
}

function connectWebSocket() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/host`;
    
    if (socket) {
        socket.close();
    }
    
    socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
        reconnectAttempts = 0;
        console.log("Host WebSocket connection open");
    };
    
    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleServerEvent(data);
    };
    
    socket.onclose = (event) => {
        console.log("Host WebSocket closed", event);
        if (!event.wasClean) {
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                console.log(`Host connection lost. Reconnecting attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}...`);
                setTimeout(() => {
                    connectWebSocket();
                }, 2000);
            } else {
                showView("error");
                document.getElementById("host-error-message").textContent = "Mất kết nối với máy chủ Quiz.";
            }
        }
    };
    
    socket.onerror = (error) => {
        console.error("Host WebSocket error", error);
        // let onclose handle the reconnection retry
    };
}

function handleServerEvent(data) {
    switch (data.event) {
        case "host_update":
            updateHostState(data);
            break;
            
        case "question_result":
            showAnswerReveal(data);
            break;
            
        case "final_results":
            showFinalPodium(data);
            break;
            
        case "error":
            alert(data.message);
            break;
    }
}

function updateHostState(data) {
    roomState = data.state;
    players = data.players;
    currentQuestionIndex = data.current_question_index;
    totalQuestions = data.total_questions;
    
    // 1. Lobby Handling
    if (roomState === "LOBBY") {
        document.getElementById("lobby-count").textContent = data.active_count;
        renderLobbyPlayers();
        showView("lobby");
        
        // Disable start game button if there are no active players
        const startBtn = document.getElementById("btn-start-game");
        if (startBtn) {
            if (data.active_count >= 1) {
                startBtn.disabled = false;
                startBtn.style.opacity = "1";
                startBtn.style.pointerEvents = "auto";
            } else {
                startBtn.disabled = true;
                startBtn.style.opacity = "0.5";
                startBtn.style.pointerEvents = "none";
            }
        }
        
        // Hide sidebar leaderboard during lobby
        sidebarLeaderboardEmpty.style.display = "block";
        sidebarLeaderboardEmpty.textContent = "Chưa có dữ liệu xếp hạng. Hãy bắt đầu game!";
        sidebarLeaderboardList.style.display = "none";
    }
    
    // 2. Question Handling
    else if (roomState === "QUESTION") {
        document.getElementById("host-q-num").textContent = currentQuestionIndex + 1;
        document.getElementById("host-q-total").textContent = totalQuestions;
        
        // Update ratios
        document.getElementById("answered-ratio").textContent = `${data.answered_count} / ${data.active_count}`;
        
        // Update timer text
        document.getElementById("host-timer").textContent = data.time_left;
        
        // Update question content (only need to set on new questions, but okay to rewrite)
        // Wait, the API doesn't send question body in host_update to keep traffic small, so host_update has minimal data.
        // But since this might be a reconnect or first load, let's keep the host_update message structure in mind.
        // Actually, our Python host_update doesn't send the full question object, but it is sent when a question starts or during reconnect.
        // Let's check how we handle the question text.
        // In python: game_state.py sends:
        // "host_update" -> state, players, current_question_index, total_questions, time_left, answered_count, active_count, stats.
        // It does not send the question object inside `host_update`. But when game starts, the host gets `new_question` or similar, or we can write the question text during host_update if needed?
        // Wait, where does the host get the question text?
        // Ah! In `game_state.py`, `send_question` sends `new_question` to player and `host_update` to host. But wait, `host_update` doesn't include the question content!
        // Oh! Let's modify `game_state.py` to send the question details to the host as well! That is an important detail.
        // Let's check `game_state.py` line 192 (send_host_update method):
        // It returns: state, players, current_question_index, total_questions, time_left, answered_count, active_count, stats.
        // Let's add `question` object to `host_update` if state is `QUESTION` or `ANSWER_REVEAL`!
        // Wait, we can modify it, but let's check first. If we send the question object in `host_update`, then the host can display it correctly.
        // Let's check if the client code needs to fetch the question.
        // Yes, if the host webpage is refreshed, it needs the current question text and options. Sending the current question inside `host_update` is the cleanest way.
        // Let's inspect the `host_update` payload first. Let's write the javascript expecting the question details to be in `data.question`.
        // I will update `game_state.py` later to include the question details in `host_update` when state is `QUESTION` or `ANSWER_REVEAL`. That is super easy and extremely robust!
        if (data.question) {
            document.getElementById("host-q-title").textContent = data.question.question;
            document.getElementById("host-opt-a").textContent = data.question.options.A;
            document.getElementById("host-opt-b").textContent = data.question.options.B;
            document.getElementById("host-opt-c").textContent = data.question.options.C;
            document.getElementById("host-opt-d").textContent = data.question.options.D;
            
            // Set image if present
            const imgEl = document.getElementById("host-q-image");
            if (imgEl) {
                if (data.question.image_url) {
                    imgEl.src = data.question.image_url;
                    imgEl.style.display = "block";
                } else {
                    imgEl.src = "";
                    imgEl.style.display = "none";
                }
            }
        }

        // Animate timer progress bar
        const progressEl = document.getElementById("host-timer-progress");
        if (data.question) {
            const timeLimit = data.question.time_limit;
            const percentage = (data.time_left / timeLimit) * 100;
            
            progressEl.style.width = `${percentage}%`;
            progressEl.style.transition = "none";
            progressEl.offsetHeight; // Reflow
            progressEl.style.transition = `width ${data.time_left}s linear`;
            progressEl.style.width = "0%";
        }
        
        showView("question");
        
        // Show live leaderboard in sidebar
        updateSidebarLeaderboard(data.players);
    }
}

function renderLobbyPlayers() {
    const grid = document.getElementById("lobby-player-list");
    grid.innerHTML = "";
    
    if (players.length === 0) {
        grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); font-style: italic;">Chưa có người chơi nào tham gia...</p>`;
        return;
    }
    
    players.forEach(p => {
        const bubble = document.createElement("div");
        bubble.className = "player-bubble";
        if (!p.active) {
            bubble.classList.add("offline");
            bubble.title = "Mất kết nối";
            bubble.textContent = `🚫 ${p.name}`;
        } else {
            bubble.textContent = p.name;
        }
        grid.appendChild(bubble);
    });
}

function showAnswerReveal(data) {
    showView("reveal");
    
    const q = data.question;
    document.getElementById("reveal-q-title").textContent = q.question;
    
    // Set image if present
    const imgEl = document.getElementById("reveal-q-image");
    if (imgEl) {
        if (q.image_url) {
            imgEl.src = q.image_url;
            imgEl.style.display = "block";
        } else {
            imgEl.src = "";
            imgEl.style.display = "none";
        }
    }
    
    // Set response option texts
    document.getElementById("reveal-text-a").textContent = q.options.A;
    document.getElementById("reveal-text-b").textContent = q.options.B;
    document.getElementById("reveal-text-c").textContent = q.options.C;
    document.getElementById("reveal-text-d").textContent = q.options.D;
    
    // Reset correctness formatting
    const options = ["a", "b", "c", "d"];
    options.forEach(opt => {
        const el = document.getElementById(`reveal-opt-${opt}`);
        el.classList.remove("correct");
        // Remove badge if any
        const badge = el.querySelector(".reveal-badge");
        if (badge) badge.remove();
    });
    
    // Highlight correct answer
    const correctLower = q.correct.toLowerCase();
    const correctEl = document.getElementById(`reveal-opt-${correctLower}`);
    correctEl.classList.add("correct");
    
    const badge = document.createElement("span");
    badge.className = "reveal-badge";
    badge.textContent = "ĐÚNG";
    correctEl.insertBefore(badge, correctEl.firstChild);
    
    // Statistics animation
    const stats = data.stats;
    const totalAnswers = Object.values(stats).reduce((a, b) => a + b, 0);
    
    options.forEach(opt => {
        const upper = opt.toUpperCase();
        const count = stats[upper] || 0;
        const percentage = totalAnswers > 0 ? (count / totalAnswers) * 100 : 0;
        
        const barFill = document.getElementById(`bar-${opt}`);
        const barCountText = document.getElementById(`count-${opt}`);
        
        barFill.style.width = `${percentage}%`;
        barCountText.textContent = `${count} (${Math.round(percentage)}%)`;
    });
    
    // Update live leaderboard
    updateSidebarLeaderboard(data.leaderboard);
}

function updateSidebarLeaderboard(leaderboardData) {
    if (!leaderboardData || leaderboardData.length === 0) {
        sidebarLeaderboardEmpty.style.display = "block";
        sidebarLeaderboardEmpty.textContent = "Đang chờ kết quả bảng xếp hạng...";
        sidebarLeaderboardList.style.display = "none";
        return;
    }
    
    sidebarLeaderboardEmpty.style.display = "none";
    sidebarLeaderboardList.style.display = "block";
    sidebarLeaderboardList.innerHTML = "";
    
    leaderboardData.forEach((p, idx) => {
        const item = document.createElement("div");
        item.className = "leaderboard-item";
        if (!p.active) {
            item.style.opacity = "0.5";
        }
        item.innerHTML = `
            <div class="leaderboard-rank-name">
                <span class="leaderboard-rank">#${idx + 1}</span>
                <span class="leaderboard-name">${escapeHtml(p.name)} ${p.active ? '' : '🔌'}</span>
            </div>
            <span class="leaderboard-score">${p.score} pts</span>
        `;
        sidebarLeaderboardList.appendChild(item);
    });
}

function showFinalPodium(data) {
    showView("finished");
    
    const leaderboard = data.leaderboard;
    
    // Helpers to fill podium step
    const setPodiumStep = (rank, player) => {
        const nameEl = document.getElementById(`podium-${rank}-name`);
        const scoreEl = document.getElementById(`podium-${rank}-score`);
        
        if (player) {
            nameEl.textContent = player.name;
            scoreEl.textContent = `${player.score} pts`;
            nameEl.parentElement.style.visibility = "visible";
        } else {
            nameEl.textContent = "";
            scoreEl.textContent = "";
            nameEl.parentElement.style.visibility = "hidden";
        }
    };
    
    // 1st place (leaderboard[0])
    setPodiumStep(1, leaderboard[0]);
    // 2nd place (leaderboard[1])
    setPodiumStep(2, leaderboard[1]);
    // 3rd place (leaderboard[2])
    setPodiumStep(3, leaderboard[2]);
    
    // Update leaderboard to show full ranks in sidebar
    updateSidebarLeaderboard(leaderboard);
}

// Host actions (Websocket messages)
function startGame() {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ event: "start_game" }));
    }
}

function endQuestionEarly() {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ event: "end_question" }));
    }
}

function nextQuestion() {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ event: "next_question" }));
    }
}

function resetGame() {
    if (confirm("Bạn có chắc chắn muốn reset trò chơi? Toàn bộ điểm số sẽ được đặt lại về 0.")) {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ event: "reset_game" }));
        }
    }
}

function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
