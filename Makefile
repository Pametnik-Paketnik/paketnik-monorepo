.PHONY: dev build start stop restart logs clean help

# Default target
.DEFAULT_GOAL := help

# Variables
DC = docker compose -f docker-compose.dev.yml

# Development commands
dev: ## Start all services in development mode with hot reloading
	@echo "🚀 Starting development environment..."
	$(DC) up --build

build: ## Build all services without starting them
	@echo "🏗️  Building all services..."
	$(DC) build

start: ## Start all services
	@echo "▶️  Starting all services..."
	$(DC) up

start-d: ## Start all services in detached mode
	@echo "▶️  Starting all services..."
	$(DC) up -d

stop: ## Stop all services
	@echo "⏹️  Stopping all services..."
	$(DC) down

restart: stop start ## Restart all services

logs: ## Show logs from all services
	@echo "📋 Showing logs..."
	$(DC) logs -f

clean: ## Remove all containers, networks, and volumes
	@echo "🧹 Cleaning up Docker environment..."
	$(DC) down -v
	docker system prune -f

# Service-specific commands
backend-restart: ## Restart backend service (no rebuild)
	@echo "🔄 Restarting backend service..."
	$(DC) restart backend

backend-rebuild: ## Rebuild and restart backend service
	@echo "🔨 Rebuilding and restarting backend service..."
	$(DC) up -d --build backend

backend-logs: ## Show logs from backend service
	@echo "📋 Showing backend logs..."
	$(DC) logs -f backend

frontend-logs: ## Show logs from frontend service
	@echo "📋 Showing frontend logs..."
	$(DC) logs -f frontend

face-auth-logs: ## Show logs from face-auth service
	@echo "📋 Showing face-auth logs..."
	$(DC) logs -f face-auth

# Help command
help: ## Show this help message
	@echo "📚 Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}' 