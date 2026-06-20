let socket = null;
let playerId = localStorage.getItem("quiz_player_id") || null;
let playerName = localStorage.getItem("quiz_player_name") || null;
let questionStartTime = null;
let timerInterval = null;
let hasAnswered = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;

// Elements
const views = {
    join: document.getElementById("view-join"),
    lobby: document.getElementById("view-lobby"),
    question: document.getElementById("view-question"),
    feedback: document.getElementById("view-feedback"),
    gameover: document.getElementById("view-gameover"),
    error: document.getElementById("view-error")
};

// Initialize app on page load
window.addEventListener("DOMContentLoaded", () => {
    if (playerId && playerName) {
        // Automatically attempt to reconnect if credentials exist
        document.getElementById("player-name").value = playerName;
        attemptReconnect();
    } else {
        showView("join");
    }
});

function showView(viewId) {
    Object.keys(views).forEach(key => {
        if (key === viewId) {
            views[key].classList.add("active");
        } else {
            views[key].classList.remove("active");
        }
    });
}

function handleJoinSubmit(event) {
    event.preventDefault();
    const nameInput = document.getElementById("player-name");
    const name = nameInput.value.trim();
    if (!name) return;
    
    playerName = name;
    connectWebSocket(name);
}

function connectWebSocket(name) {
    // Determine ws/wss protocol
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/player`;
    
    showView("lobby");
    document.getElementById("lobby-my-name").textContent = name;
    document.getElementById("lobby-players-count").textContent = "...";
    
    if (socket) {
        socket.close();
    }
    
    socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
        reconnectAttempts = 0;
        hideReconnectToast();
        // Send join event
        socket.send(JSON.stringify({
            event: "join",
            name: name,
            player_id: playerId // Send if we have one, otherwise null/empty
        }));
    };
    
    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleServerEvent(data);
    };
    
    socket.onclose = (event) => {
        console.log("WebSocket closed", event);
        // Only show error view if we weren't intentionally leaving
        if (socket && !event.wasClean) {
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                showReconnectToast(`Mất kết nối. Đang tự động kết nối lại (Lần ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
                setTimeout(() => {
                    if (playerName) connectWebSocket(playerName);
                }, 2000);
            } else {
                hideReconnectToast();
                document.getElementById("error-message").textContent = "Mất kết nối với máy chủ quiz.";
                showView("error");
            }
        }
    };
    
    socket.onerror = (error) => {
        console.error("WebSocket error", error);
        // Let onclose handler manage the reconnection
    };
}

function attemptReconnect() {
    reconnectAttempts = 0;
    hideReconnectToast();
    if (playerName) {
        connectWebSocket(playerName);
    } else {
        showView("join");
    }
}

function handleServerEvent(data) {
    switch (data.event) {
        case "join_success":
            playerId = data.player_id;
            playerName = data.name;
            localStorage.setItem("quiz_player_id", playerId);
            localStorage.setItem("quiz_player_name", playerName);
            
            document.getElementById("lobby-my-name").textContent = playerName;
            
            // Jump to the correct view based on current server state
            if (data.state === "LOBBY") {
                showView("lobby");
            }
            break;
            
        case "lobby_update":
        case "lobby_state":
            document.getElementById("lobby-players-count").textContent = data.active_players;
            // Only force lobby view if currently in join or error
            if (views.join.classList.contains("active") || views.error.classList.contains("active")) {
                showView("lobby");
            }
            break;
            
        case "new_question":
            setupQuestion(data);
            break;
            
        case "answer_received":
            hasAnswered = true;
            disableOptionButtons();
            document.getElementById("wait-message").style.display = "block";
            // Visual style for selected option is handled in click submitAnswer
            break;
            
        case "question_end":
            clearInterval(timerInterval);
            showFeedback(data);
            break;
            
        case "game_over":
            clearInterval(timerInterval);
            showGameOver(data);
            break;
            
        case "game_reset":
            resetClientSession();
            break;
            
        case "error":
            document.getElementById("error-message").textContent = data.message;
            showView("error");
            break;
    }
}

function setupQuestion(data) {
    hasAnswered = data.has_answered;
    questionStartTime = Date.now();
    
    // UI Updates
    document.getElementById("question-num").textContent = data.question_index + 1;
    document.getElementById("question-total").textContent = data.total_questions;
    document.getElementById("question-title").textContent = data.question.text;
    
    // Set options
    document.getElementById("text-opt-a").textContent = data.question.options.A;
    document.getElementById("text-opt-b").textContent = data.question.options.B;
    document.getElementById("text-opt-c").textContent = data.question.options.C;
    document.getElementById("text-opt-d").textContent = data.question.options.D;
    
    // Reset option buttons classes
    const buttons = ["a", "b", "c", "d"];
    buttons.forEach(letter => {
        const btn = document.getElementById(`btn-opt-${letter}`);
        btn.classList.remove("selected", "disabled");
    });
    
    // Show wait message if already answered (in case of reconnect)
    if (hasAnswered) {
        disableOptionButtons();
        document.getElementById("wait-message").style.display = "block";
    } else {
        document.getElementById("wait-message").style.display = "none";
    }
    
    // Timer logic
    const timeLimit = data.question.time_limit;
    // If reconnected mid-question, start from timeLeft
    let timeLeft = data.time_left !== undefined ? data.time_left : timeLimit;
    
    const timerEl = document.getElementById("question-timer");
    const progressEl = document.getElementById("question-progress");
    
    timerEl.textContent = timeLeft;
    
    // Calculate and set initial progress bar width
    const startPercentage = (timeLeft / timeLimit) * 100;
    progressEl.style.width = `${startPercentage}%`;
    progressEl.style.transition = "none";
    
    // Trigger reflow to apply transition-none immediately
    progressEl.offsetHeight; 
    
    // Animate down to 0%
    progressEl.style.transition = `width ${timeLeft}s linear`;
    progressEl.style.width = "0%";
    
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
            timeLeft = 0;
            clearInterval(timerInterval);
            disableOptionButtons();
        }
        timerEl.textContent = timeLeft;
    }, 1000);
    
    showView("question");
}

function submitAnswer(option) {
    if (hasAnswered || !socket || socket.readyState !== WebSocket.OPEN) return;
    
    // Add visual selection
    document.getElementById(`btn-opt-${option.toLowerCase()}`).classList.add("selected");
    
    // Disable other buttons
    disableOptionButtons();
    
    // Calculate time taken
    const timeTaken = (Date.now() - questionStartTime) / 1000;
    
    // Send to server
    socket.send(JSON.stringify({
        event: "submit_answer",
        answer: option,
        time_taken: timeTaken
    }));
}

function disableOptionButtons() {
    ["a", "b", "c", "d"].forEach(letter => {
        document.getElementById(`btn-opt-${letter}`).classList.add("disabled");
    });
}

function showFeedback(data) {
    const feedbackTitle = document.getElementById("feedback-title");
    const feedbackIcon = document.getElementById("feedback-icon");
    const feedbackPoints = document.getElementById("feedback-points");
    const feedbackRank = document.getElementById("feedback-rank");
    const feedbackScore = document.getElementById("feedback-score");
    const correctReveal = document.getElementById("correct-answer-reveal");
    const correctText = document.getElementById("correct-answer-text");
    
    feedbackScore.textContent = data.total_score;
    feedbackRank.textContent = data.rank;
    
    if (data.is_correct) {
        feedbackTitle.textContent = "Chính Xác!";
        feedbackTitle.className = "feedback-title correct";
        feedbackIcon.textContent = "🎉";
        feedbackPoints.textContent = data.points_earned;
        correctReveal.style.display = "none";
    } else {
        feedbackTitle.textContent = data.your_answer ? "Sai Rồi!" : "Hết Giờ!";
        feedbackTitle.className = "feedback-title wrong";
        feedbackIcon.textContent = data.your_answer ? "❌" : "⏰";
        feedbackPoints.textContent = "0";
        
        correctText.textContent = `${data.correct_answer}. ${data.correct_text}`;
        correctReveal.style.display = "block";
    }
    
    showView("feedback");
}

function showGameOver(data) {
    document.getElementById("gameover-rank").textContent = data.final_rank;
    document.getElementById("gameover-score").textContent = data.final_score;
    
    const leaderboardContainer = document.getElementById("gameover-leaderboard");
    leaderboardContainer.innerHTML = "";
    
    data.leaderboard.forEach((player, idx) => {
        const item = document.createElement("div");
        item.className = "leaderboard-item";
        
        // Highlight current player
        if (player.name === playerName) {
            item.classList.add("highlighted");
        }
        
        item.innerHTML = `
            <div class="leaderboard-rank-name">
                <span class="leaderboard-rank">#${idx + 1}</span>
                <span class="leaderboard-name">${escapeHtml(player.name)}</span>
            </div>
            <span class="leaderboard-score">${player.score} pts</span>
        `;
        leaderboardContainer.appendChild(item);
    });
    
    showView("gameover");
}

function resetClientSession() {
    localStorage.removeItem("quiz_player_id");
    localStorage.removeItem("quiz_player_name");
    playerId = null;
    playerName = null;
    if (socket) {
        socket.close(1000, "Intended disconnect");
        socket = null;
    }
    showView("join");
    document.getElementById("player-name").value = "";
}

function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showReconnectToast(message) {
    let toast = document.getElementById("reconnect-toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "reconnect-toast";
        toast.style.position = "fixed";
        toast.style.top = "20px";
        toast.style.left = "50%";
        toast.style.transform = "translateX(-50%)";
        toast.style.background = "rgba(255, 193, 7, 0.95)";
        toast.style.color = "#121240";
        toast.style.padding = "10px 20px";
        toast.style.borderRadius = "30px";
        toast.style.fontWeight = "600";
        toast.style.fontSize = "0.9rem";
        toast.style.boxShadow = "0 4px 15px rgba(0,0,0,0.35)";
        toast.style.zIndex = "9999";
        toast.style.textAlign = "center";
        toast.style.pointerEvents = "none";
        document.body.appendChild(toast);
    }
    toast.textContent = message;
}

function hideReconnectToast() {
    const toast = document.getElementById("reconnect-toast");
    if (toast) {
        toast.remove();
    }
}
