SESSION_NAME = thread-app

run:
	tmux new-session -d -s $(SESSION_NAME) "uv run server.py" \; \
		split-window -v "npm run dev --prefix ./thread" \; \
		attach -t $(SESSION_NAME)

attach:
	tmux attach -t $(SESSION_NAME) || echo "Session '$(SESSION_NAME)' not found"

kill:
	tmux kill-session -t $(SESSION_NAME) || echo "No session to kill"
