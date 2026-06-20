import os
import uuid
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse
from game_state import GameStateManager

app = FastAPI(title="Real-time Multiplayer Quiz App")

# Initialize the shared game manager
manager = GameStateManager()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Serve static files
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")

@app.get("/")
async def get_player_page():
    return FileResponse(os.path.join(BASE_DIR, "static", "index.html"))

@app.get("/host")
async def get_host_page():
    return FileResponse(os.path.join(BASE_DIR, "static", "host.html"))

@app.websocket("/ws/player")
async def websocket_player(websocket: WebSocket):
    await websocket.accept()
    player_id = None
    try:
        while True:
            data = await websocket.receive_json()
            event = data.get("event")
            
            if event == "join":
                name = data.get("name", "Người chơi").strip()
                if not name:
                    name = "Người chơi"
                
                # Check for client-provided player_id (for reconnection)
                client_player_id = data.get("player_id")
                if client_player_id and client_player_id in manager.players:
                    player_id = client_player_id
                else:
                    player_id = uuid.uuid4().hex
                
                await manager.add_player(player_id, name, websocket)
                
            elif event == "submit_answer":
                if player_id:
                    answer = data.get("answer")
                    time_taken = float(data.get("time_taken", 0))
                    await manager.submit_answer(player_id, answer, time_taken)
                    
    except WebSocketDisconnect:
        if player_id and player_id in manager.players:
            player = manager.players[player_id]
            if player.websocket == websocket:
                player.active = False
                player.websocket = None
                
                # Notify host and other players about the disconnection
                await manager.send_host_update()
                await manager.broadcast_to_players({
                    "event": "lobby_update",
                    "active_players": sum(1 for p in manager.players.values() if p.active)
                })
            
    except Exception as e:
        print(f"Error on player websocket: {e}")
        if player_id and player_id in manager.players:
            player = manager.players[player_id]
            if player.websocket == websocket:
                player.active = False
                player.websocket = None

@app.websocket("/ws/host")
async def websocket_host(websocket: WebSocket):
    await websocket.accept()
    
    # Store host websocket and send immediate status update
    manager.host_websocket = websocket
    await manager.send_host_update()
    
    try:
        while True:
            data = await websocket.receive_json()
            event = data.get("event")
            
            if event == "start_game":
                await manager.start_game()
            elif event == "end_question":
                await manager.reveal_answer()
            elif event == "next_question":
                await manager.next_question()
            elif event == "reset_game":
                manager.reset_game()
                await manager.send_host_update()
                await manager.broadcast_to_players({
                    "event": "game_reset"
                })
                
    except WebSocketDisconnect:
        if manager.host_websocket == websocket:
            manager.host_websocket = None
    except Exception as e:
        print(f"Error on host websocket: {e}")
        if manager.host_websocket == websocket:
            manager.host_websocket = None
