REGISTRY_BASE_URL ?= registry.appodeal.com
COMPANY_NAME ?= appodeal
APP_NAME ?= admob-sync-app

docker-build:
	docker build -t $(REGISTRY_BASE_URL)/$(COMPANY_NAME)/$(APP_NAME):$(TAG) .
docker-build-mac:
	docker build -f Dockerfile_mac --build-arg SENTRY_TOKEN=$(SENTRY_TOKEN) -t $(REGISTRY_BASE_URL)/$(COMPANY_NAME)/$(APP_NAME):$(TAG) ./dist
docker-push:
	docker push $(REGISTRY_BASE_URL)/$(COMPANY_NAME)/$(APP_NAME):$(TAG)
