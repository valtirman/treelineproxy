RECIPEPREFIX := >

.RECIPEPREFIX := >
# Add OPA ports so we kill them too
PORTS=15000 19901 8080 8081 9090 8181 9191
PAT=treeline|envoy|mitm|opa
.PHONY: nuke deepclean up down test logs who

who:
> echo "== Containers matching ($(PAT)) =="
> docker ps -a --format 'table {{.ID}}\t{{.Image}}\t{{.Names}}' | egrep -i '(^ID|'"$(PAT)"')' || true
> echo "== Listeners on project ports =="
> sudo ss -lntp | egrep ':(15000|19901|8080|8081|9090|8181|9191)\b' || true

nuke:
> echo "== Removing matching containers =="
> docker ps -a --format '{{.ID}} {{.Image}} {{.Names}}' | egrep -i '('"$(PAT)"')' | awk '{print $$1}' | xargs -r docker rm -f
> echo "== Killing any processes on project ports =="
> for p in $(PORTS); do sudo fuser -k $$p/tcp || true; done
> echo "== Pruning unused Docker artifacts (images, nets, vols) =="
> docker system prune -af --volumes
> echo "== Removing matching custom networks =="
> docker network ls --format '{{.Name}}' | egrep -i '('"$(PAT)"'|proxy|mesh)' | xargs -r docker network rm

# Nuclear option: also kill any leftover host processes named 'opa' and purge images.
deepclean: nuke
> echo "== Killing stray host processes named 'opa' (if any) =="
> pgrep -fa opa || true; sudo pkill -f opa || true
> echo "== Removing OPA images (optional) =="
> docker images --format '{{.Repository}}:{{.Tag}} {{.ID}}' | egrep -i 'openpolicyagent/opa' | awk '{print $$2}' | xargs -r docker rmi -f
> echo "== (Optional) Remove mitm CA cache (dev certs) =="
> rm -rf $$HOME/.mitmproxy || true

up:
> docker compose up -d

down:
> docker compose down -v

test:
> echo "Envoy ready:" && curl -s http://localhost:19901/ready | head -n1 || true
> echo "HTTPS via proxy:" && curl -k -s -o /dev/null -w '%{http_code}\n' -x http://localhost:15000 https://example.com/
> echo "Block check (Bearer):" && curl -k -x http://localhost:15000 https://httpbin.org/post -H "Authorization: Bearer abc123" -d 'hello' -i | head -n20
> echo "Redaction header (SSN):" && curl -k -x http://localhost:15000 https://httpbin.org/anything -d 'customer=John&ssn=123-45-6789' -i | grep -i X-Treeline-Action || true
> echo "Addon health:" && curl -s http://localhost:9090/healthz
> echo "Addon metrics:" && curl -s http://localhost:9090/metrics | sed -n '1,8p'

logs:
> docker logs $$(docker ps --format '{{.Names}}' | grep -m1 envoy) --tail=200 2>/dev/null || true
> docker logs $$(docker ps --format '{{.Names}}' | grep -m1 mitm) --tail=200 2>/dev/null || true
.PHONY: health soak chaos

health:
> docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -E 'envoy|mitm' || true
> echo "READY: $$(curl -s http://localhost:19901/ready)"
> echo -n "UPSTREAM HEALTHY: "
> curl -s "http://localhost:19901/stats?format=prometheus" | \
>   awk -F' ' '/^envoy_cluster_membership_healthy\{[^}]*envoy_cluster_name="mitm"[^}]*\} /{print $$2; exit}'

soak:
> for i in $$(seq 1 60); do \
>   curl -k -s -o /dev/null -w '%{http_code}\n' -x http://localhost:15000 https://example.com/ || true; \
>   sleep 1; \
> done

chaos:
> docker rm -f treelineproxy-v4-mitmproxy-1 || true
> sleep 12
> docker ps --format 'table {{.Names}}\t{{.Status}}' | grep envoy || true
> docker compose up -d mitmproxy
> sleep 8
> $$(MAKE) health
.PHONY: health

health:
> @docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -E 'envoy|mitm' || true
> @echo "READY: $$(curl -s http://localhost:19901/ready)"
> @echo "UPSTREAM HEALTHY: $$(curl -s 'http://localhost:19901/stats?format=prometheus' | awk -F' ' '/^envoy_cluster_membership_healthy\{[^}]*envoy_cluster_name="mitm"[^}]*\} /{print $$2; exit}')"
