.PHONY: dev server web deploy

# On Unix/macOS: make dev
# On Windows (PowerShell): make dev-win
dev:
	$(MAKE) server & $(MAKE) web & wait

dev-win:
	powershell -Command "Start-Process -NoNewWindow powershell -ArgumentList '-Command cd apps/server; uvicorn main:app --reload --port 8000'; cd apps/web; npm run dev"

server:
	cd apps/server ; uvicorn main:app --reload --port 8000

web:
	cd apps; cd web ; npm run dev

deploy:
	cd apps/server ; python -m modal deploy modal_app/deploy.py
