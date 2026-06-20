import time
import asyncio
import random
from typing import Dict, List, Optional
from fastapi import WebSocket

QUESTIONS = [
    {
        "id": 1,
        "question": "Đây là lá cờ của quốc gia nào?",
        "options": {
            "A": "Brazil",
            "B": "Argentina",
            "C": "Đức",
            "D": "Tây Ban Nha"
        },
        "correct": "A",
        "time_limit": 20,
        "image_url": "https://flagcdn.com/w320/br.png"
    },
    {
        "id": 2,
        "question": "Đây là lá cờ của quốc gia nào?",
        "options": {
            "A": "Nhật Bản",
            "B": "Hàn Quốc",
            "C": "Trung Quốc",
            "D": "Việt Nam"
        },
        "correct": "B",
        "time_limit": 20,
        "image_url": "https://flagcdn.com/w320/kr.png"
    },
    {
        "id": 3,
        "question": "Đây là lá cờ của quốc gia nào?",
        "options": {
            "A": "Colombia",
            "B": "Bồ Đào Nha",
            "C": "Ý",
            "D": "Pháp"
        },
        "correct": "B",
        "time_limit": 20,
        "image_url": "https://flagcdn.com/w320/pt.png"
    },
    {
        "id": 4,
        "question": "Đây là lá cờ của quốc gia nào?",
        "options": {
            "A": "Croatia",
            "B": "Pháp",
            "C": "Anh",
            "D": "Panama"
        },
        "correct": "A",
        "time_limit": 20,
        "image_url": "https://flagcdn.com/w320/hr.png"
    },
    {
        "id": 5,
        "question": "Đây là lá cờ của quốc gia nào?",
        "options": {
            "A": "Đức",
            "B": "Ecuador",
            "C": "Bỉ",
            "D": "Hà Lan"
        },
        "correct": "A",
        "time_limit": 20,
        "image_url": "https://flagcdn.com/w320/de.png"
    },
    {
        "id": 6,
        "question": "World Cup 2026 là kỳ World Cup lịch sử đầu tiên có sự tham gia của bao nhiêu đội tuyển?",
        "options": {
            "A": "32 đội",
            "B": "40 đội",
            "C": "48 đội",
            "D": "64 đội"
        },
        "correct": "C",
        "time_limit": 20
    },
    {
        "id": 7,
        "question": "World Cup 2026 được đồng tổ chức bởi liên minh gồm 3 quốc gia nào?",
        "options": {
            "A": "Mỹ, Canada, Mexico",
            "B": "Tây Ban Nha, Bồ Đào Nha, Maroc",
            "C": "Nhật Bản, Hàn Quốc, Úc",
            "D": "Argentina, Uruguay, Paraguay"
        },
        "correct": "A",
        "time_limit": 20
    },
    {
        "id": 8,
        "question": "Tổng số trận đấu sẽ được diễn ra tại vòng chung kết World Cup 2026 là bao nhiêu trận?",
        "options": {
            "A": "64 trận",
            "B": "80 trận",
            "C": "104 trận",
            "D": "120 trận"
        },
        "correct": "C",
        "time_limit": 20
    },
    {
        "id": 9,
        "question": "Các đội tuyển tham dự World Cup 2026 được chia thành bao nhiêu bảng đấu tại vòng bảng?",
        "options": {
            "A": "8 bảng",
            "B": "10 bảng",
            "C": "12 bảng",
            "D": "16 bảng"
        },
        "correct": "C",
        "time_limit": 20
    },
    {
        "id": 10,
        "question": "Mỗi bảng đấu tại vòng bảng World Cup 2026 sẽ bao gồm bao nhiêu đội tuyển tranh tài?",
        "options": {
            "A": "3 đội",
            "B": "4 đội",
            "C": "5 đội",
            "D": "6 đội"
        },
        "correct": "B",
        "time_limit": 20
    },
    {
        "id": 11,
        "question": "Quốc gia nào có nhiều thành phố đăng cai tổ chức các trận đấu World Cup 2026 nhất (với 11 trong tổng số 16 thành phố)?",
        "options": {
            "A": "Mỹ",
            "B": "Canada",
            "C": "Mexico",
            "D": "Brazil"
        },
        "correct": "A",
        "time_limit": 20
    },
    {
        "id": 12,
        "question": "Trận khai mạc của World Cup 2026 ngày 11/06/2026 sẽ diễn ra tại sân vận động nào ở Mexico?",
        "options": {
            "A": "Sân Azteca",
            "B": "Sân SoFi",
            "C": "Sân MetLife",
            "D": "Sân BC Place"
        },
        "correct": "A",
        "time_limit": 20
    },
    {
        "id": 13,
        "question": "Trận chung kết World Cup 2026 diễn ra vào ngày 19/07/2026 sẽ được tổ chức tại sân vận động nào?",
        "options": {
            "A": "Sân Azteca",
            "B": "Sân SoFi",
            "C": "Sân MetLife",
            "D": "Sân BC Place"
        },
        "correct": "C",
        "time_limit": 20
    },
    {
        "id": 14,
        "question": "Canada đăng cai tổ chức các trận đấu World Cup 2026 tại hai thành phố nào?",
        "options": {
            "A": "Toronto và Vancouver",
            "B": "Montreal và Ottawa",
            "C": "Calgary và Edmonton",
            "D": "Quebec và Winnipeg"
        },
        "correct": "A",
        "time_limit": 20
    },
    {
        "id": 15,
        "question": "Mexico đăng cai tổ chức các trận đấu World Cup 2026 tại ba thành phố nào?",
        "options": {
            "A": "Mexico City, Monterrey, Guadalajara",
            "B": "Mexico City, Cancun, Tijuana",
            "C": "Monterrey, Guadalajara, Puebla",
            "D": "Leon, Merida, Toluca"
        },
        "correct": "A",
        "time_limit": 20
    },
    {
        "id": 16,
        "question": "Bài hát chính thức nằm trong album World Cup 2026 do nữ ca sĩ Shakira hợp tác biểu diễn có tên là gì?",
        "options": {
            "A": "Waka Waka",
            "B": "La La La",
            "C": "Stronger",
            "D": "We Are One"
        },
        "correct": "C",
        "time_limit": 20
    },
    {
        "id": 17,
        "question": "Vòng chung kết World Cup 2026 kéo dài trong khoảng thời gian nào?",
        "options": {
            "A": "Từ 01/06 đến 30/06/2026",
            "B": "Từ 11/06 đến 19/07/2026",
            "C": "Từ 15/06 đến 15/07/2026",
            "D": "Từ 20/11 đến 18/12/2026"
        },
        "correct": "B",
        "time_limit": 20
    },
    {
        "id": 18,
        "question": "Tổng cộng có bao nhiêu sân vận động được sử dụng để tổ chức các trận đấu tại World Cup 2026?",
        "options": {
            "A": "12 sân",
            "B": "16 sân",
            "C": "18 sân",
            "D": "20 sân"
        },
        "correct": "B",
        "time_limit": 20
    },
    {
        "id": 19,
        "question": "Thành phố nào của Canada có sân vận động BC Place đăng cai tổ chức các trận đấu World Cup 2026?",
        "options": {
            "A": "Vancouver",
            "B": "Toronto",
            "C": "Montreal",
            "D": "Edmonton"
        },
        "correct": "A",
        "time_limit": 20
    },
    {
        "id": 20,
        "question": "Sân vận động MetLife - nơi tổ chức trận chung kết World Cup 2026 - nằm ở bang nào của nước Mỹ?",
        "options": {
            "A": "New York / New Jersey",
            "B": "California",
            "C": "Texas",
            "D": "Florida"
        },
        "correct": "A",
        "time_limit": 20
    }
]

class Player:
    def __init__(self, player_id: str, name: str):
        self.id = player_id
        self.name = name
        self.score = 0
        self.active = True
        self.websocket: Optional[WebSocket] = None
        # Structure of answers: { question_index: { "answer": str, "time_taken": float, "correct": bool, "points": int } }
        self.answers: Dict[int, dict] = {}

class GameStateManager:
    def __init__(self):
        self.players: Dict[str, Player] = {}
        self.state: str = "LOBBY"  # LOBBY, QUESTION, ANSWER_REVEAL, FINISHED
        self.current_question_index: int = -1
        self.question_timer_task: Optional[asyncio.Task] = None
        self.time_left: int = 0
        self.host_websocket: Optional[WebSocket] = None
        random.shuffle(QUESTIONS)

    def reset_game(self):
        self.state = "LOBBY"
        self.current_question_index = -1
        self.time_left = 0
        if self.question_timer_task:
            self.question_timer_task.cancel()
            self.question_timer_task = None
        for player in self.players.values():
            player.score = 0
            player.answers = {}
        random.shuffle(QUESTIONS)

    def get_player_list(self) -> List[dict]:
        """Returns player information for the host dashboard."""
        return [
            {
                "id": p.id,
                "name": p.name,
                "score": p.score,
                "active": p.active,
                "answered": self.current_question_index in p.answers
            }
            for p in self.players.values()
        ]

    def get_leaderboard(self) -> List[dict]:
        """Returns sorted list of players by score."""
        sorted_players = sorted(self.players.values(), key=lambda p: p.score, reverse=True)
        return [
            {
                "name": p.name,
                "score": p.score,
                "active": p.active
            }
            for p in sorted_players
        ]

    def get_question_stats(self) -> dict:
        """Returns counts of how many players answered each option for the current question."""
        stats = {"A": 0, "B": 0, "C": 0, "D": 0}
        if self.current_question_index < 0 or self.current_question_index >= len(QUESTIONS):
            return stats
        for p in self.players.values():
            ans_info = p.answers.get(self.current_question_index)
            if ans_info:
                ans = ans_info.get("answer")
                if ans in stats:
                    stats[ans] += 1
        return stats

    async def broadcast_to_players(self, message: dict):
        """Sends a JSON message to all active players."""
        disconnected = []
        for p_id, player in self.players.items():
            ws = player.websocket
            if player.active and ws:
                try:
                    await ws.send_json(message)
                except Exception:
                    if player.websocket == ws:
                        player.active = False
                        player.websocket = None
                        disconnected.append(p_id)
        if disconnected and self.host_websocket:
            await self.send_host_update()

    async def send_to_host(self, message: dict):
        """Sends a JSON message to the host websocket."""
        if self.host_websocket:
            try:
                await self.host_websocket.send_json(message)
            except Exception:
                self.host_websocket = None

    async def send_host_update(self):
        """Helper to send the current player list and room status to the host."""
        q_data = None
        if self.state in ["QUESTION", "ANSWER_REVEAL"] and 0 <= self.current_question_index < len(QUESTIONS):
            q = QUESTIONS[self.current_question_index]
            q_data = {
                "question": q["question"],
                "options": q["options"],
                "time_limit": q["time_limit"],
                "correct": q["correct"]
            }
            if "image_url" in q:
                q_data["image_url"] = q["image_url"]

        await self.send_to_host({
            "event": "host_update",
            "state": self.state,
            "players": self.get_player_list(),
            "current_question_index": self.current_question_index,
            "total_questions": len(QUESTIONS),
            "time_left": self.time_left,
            "answered_count": sum(1 for p in self.players.values() if self.current_question_index in p.answers),
            "active_count": sum(1 for p in self.players.values() if p.active),
            "stats": self.get_question_stats(),
            "question": q_data
        })

    async def add_player(self, player_id: str, name: str, websocket: WebSocket) -> Player:
        """Adds a new player or reactivates an existing player."""
        if player_id in self.players:
            # Reconnect scenario
            player = self.players[player_id]
            player.name = name  # update name if they changed it
            player.active = True
            player.websocket = websocket
        else:
            # New player
            player = Player(player_id, name)
            player.websocket = websocket
            self.players[player_id] = player

        # Send join confirmation
        await websocket.send_json({
            "event": "join_success",
            "player_id": player.id,
            "name": player.name,
            "score": player.score,
            "state": self.state
        })

        # Sync player with current game state
        await self.sync_player_state(player)
        
        # Notify host
        await self.send_host_update()
        # Broadcast lobby counts to other players
        await self.broadcast_to_players({
            "event": "lobby_update",
            "active_players": sum(1 for p in self.players.values() if p.active)
        })
        return player

    async def sync_player_state(self, player: Player):
        """Sends the current state data to a player (helpful on initial join or reconnect)."""
        if self.state == "LOBBY":
            await player.websocket.send_json({
                "event": "lobby_state",
                "active_players": sum(1 for p in self.players.values() if p.active)
            })
        elif self.state == "QUESTION":
            # If the player has already answered the current question
            has_answered = self.current_question_index in player.answers
            q = QUESTIONS[self.current_question_index]
            q_data = {
                "text": q["question"],
                "options": q["options"],
                "time_limit": q["time_limit"]
            }
            if "image_url" in q:
                q_data["image_url"] = q["image_url"]
            await player.websocket.send_json({
                "event": "new_question",
                "question": q_data,
                "question_index": self.current_question_index,
                "total_questions": len(QUESTIONS),
                "time_left": self.time_left,
                "has_answered": has_answered
            })
        elif self.state == "ANSWER_REVEAL":
            q = QUESTIONS[self.current_question_index]
            ans_info = player.answers.get(self.current_question_index, {})
            await player.websocket.send_json({
                "event": "question_end",
                "correct_answer": q["correct"],
                "correct_text": q["options"][q["correct"]],
                "your_answer": ans_info.get("answer"),
                "is_correct": ans_info.get("correct", False),
                "points_earned": ans_info.get("points", 0),
                "total_score": player.score,
                "rank": self.get_player_rank(player.id)
            })
        elif self.state == "FINISHED":
            await player.websocket.send_json({
                "event": "game_over",
                "leaderboard": self.get_leaderboard()[:5], # Top 5 to show
                "final_rank": self.get_player_rank(player.id),
                "final_score": player.score
            })

    def get_player_rank(self, player_id: str) -> int:
        sorted_players = sorted(self.players.keys(), key=lambda k: self.players[k].score, reverse=True)
        try:
            return sorted_players.index(player_id) + 1
        except ValueError:
            return 0

    async def submit_answer(self, player_id: str, answer: str, time_taken: float):
        """Processes an answer submitted by a player."""
        if self.state != "QUESTION":
            return
        player = self.players.get(player_id)
        if not player or self.current_question_index in player.answers:
            # Player already answered or doesn't exist
            return

        q = QUESTIONS[self.current_question_index]
        is_correct = (answer == q["correct"])
        points = 0
        if is_correct:
            # Score formula: base 500 points, plus up to 500 speed bonus points
            # Maximum time is q["time_limit"]
            time_ratio = max(0.0, min(1.0, time_taken / q["time_limit"]))
            speed_bonus = int(500 * (1.0 - time_ratio))
            points = 500 + speed_bonus
            player.score += points

        player.answers[self.current_question_index] = {
            "answer": answer,
            "time_taken": time_taken,
            "correct": is_correct,
            "points": points
        }

        # Tell the player their answer was recorded
        if player.websocket:
            try:
                await player.websocket.send_json({
                    "event": "answer_received",
                    "answer": answer
                })
            except Exception:
                pass

        # Update host and check if everyone has answered
        await self.send_host_update()

        active_players = [p for p in self.players.values() if p.active]
        answered_players = [p for p in active_players if self.current_question_index in p.answers]
        
        # If all active players have answered, end the question early
        if len(active_players) > 0 and len(answered_players) == len(active_players):
            await self.reveal_answer()

    async def start_game(self):
        """Starts the game by displaying the first question."""
        active_count = sum(1 for p in self.players.values() if p.active)
        if active_count < 1:
            await self.send_to_host({"event": "error", "message": "Cần tối thiểu 1 người chơi online để bắt đầu trò chơi!"})
            return
        self.state = "QUESTION"
        self.current_question_index = 0
        await self.send_question()

    async def send_question(self):
        """Sends the current question to all players and starts the countdown timer."""
        self.state = "QUESTION"
        q = QUESTIONS[self.current_question_index]
        self.time_left = q["time_limit"]
        
        # Clear timer task if any
        if self.question_timer_task:
            self.question_timer_task.cancel()
        
        # Notify players
        q_data = {
            "text": q["question"],
            "options": q["options"],
            "time_limit": q["time_limit"]
        }
        if "image_url" in q:
            q_data["image_url"] = q["image_url"]
        await self.broadcast_to_players({
            "event": "new_question",
            "question": q_data,
            "question_index": self.current_question_index,
            "total_questions": len(QUESTIONS),
            "time_left": self.time_left,
            "has_answered": False
        })
        
        # Notify host
        await self.send_host_update()
        
        # Start countdown background task
        self.question_timer_task = asyncio.create_task(self.countdown_timer())

    async def countdown_timer(self):
        try:
            while self.time_left > 0:
                await asyncio.sleep(1)
                self.time_left -= 1
                # Send countdown update to host only (to save websocket traffic)
                await self.send_host_update()
            
            # Timer finished, reveal answer
            await self.reveal_answer()
        except asyncio.CancelledError:
            pass

    async def reveal_answer(self):
        """Stops the timer and reveals the correct answer to all players and the host."""
        if self.question_timer_task:
            self.question_timer_task.cancel()
            self.question_timer_task = None
            
        self.state = "ANSWER_REVEAL"
        q = QUESTIONS[self.current_question_index]
        
        # Send result to each player customized with their score/rank
        for player_id, player in self.players.items():
            ws = player.websocket
            if player.active and ws:
                ans_info = player.answers.get(self.current_question_index, {})
                try:
                    await ws.send_json({
                        "event": "question_end",
                        "correct_answer": q["correct"],
                        "correct_text": q["options"][q["correct"]],
                        "your_answer": ans_info.get("answer"),
                        "is_correct": ans_info.get("correct", False),
                        "points_earned": ans_info.get("points", 0),
                        "total_score": player.score,
                        "rank": self.get_player_rank(player_id)
                    })
                except Exception:
                    if player.websocket == ws:
                        player.active = False
                        player.websocket = None

        # Send update to host with stats and leaderboard
        await self.send_host_update()
        await self.send_to_host({
            "event": "question_result",
            "question": q,
            "stats": self.get_question_stats(),
            "leaderboard": self.get_leaderboard()[:10]  # Show top 10 on host screen
        })

    async def next_question(self):
        """Moves to the next question or finishes the game if no questions are left."""
        if self.state != "ANSWER_REVEAL":
            return
        
        self.current_question_index += 1
        if self.current_question_index < len(QUESTIONS):
            await self.send_question()
        else:
            self.state = "FINISHED"
            leaderboard = self.get_leaderboard()
            
            # Notify players game is over
            for player_id, player in self.players.items():
                ws = player.websocket
                if player.active and ws:
                    try:
                        await ws.send_json({
                            "event": "game_over",
                            "leaderboard": leaderboard[:5],
                            "final_rank": self.get_player_rank(player_id),
                            "final_score": player.score
                        })
                    except Exception:
                        if player.websocket == ws:
                            player.active = False
                            player.websocket = None
            
            # Notify host
            await self.send_host_update()
            await self.send_to_host({
                "event": "final_results",
                "leaderboard": leaderboard
            })
