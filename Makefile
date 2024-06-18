REGISTRY_BASE_URL ?= registry.appodeal.com
COMPANY_NAME ?= appodeal
APP_NAME ?= admob-sync-app

docker-build:
	docker build -t $(REGISTRY_BASE_URL)/$(COMPANY_NAME)/$(APP_NAME):$(TAG) .
docker-build-mac:
	docker build -f Dockerfile_mac -t $(REGISTRY_BASE_URL)/$(COMPANY_NAME)/$(APP_NAME):$(TAG) ./dist
	docker tag "$(REGISTRY_BASE_URL)/$(COMPANY_NAME)/$(APP_NAME):$(TAG)" "$(REGISTRY_BASE_URL)/$(COMPANY_NAME)/$(APP_NAME):latest"
docker-push:
	docker push $(REGISTRY_BASE_URL)/$(COMPANY_NAME)/$(APP_NAME):$(TAG)
	docker push $(REGISTRY_BASE_URL)/$(COMPANY_NAME)/$(APP_NAME):latest
