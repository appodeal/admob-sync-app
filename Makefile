REGISTRY_BASE_URL ?= registry.appodeal.com
COMPANY_NAME ?= appodeal
APP_NAME ?= admob-sync-app

docker-build:
	docker build -t $(REGISTRY_BASE_URL)/$(COMPANY_NAME)/$(APP_NAME):$(TAG) .
docker-push:
	docker push $(REGISTRY_BASE_URL)/$(COMPANY_NAME)/$(APP_NAME):$(TAG)
