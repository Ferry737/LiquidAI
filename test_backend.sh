#!/bin/bash

# LiquidAI v2.0 - Backend API Comprehensive Test Suite
# Tests all API endpoints and features

API_BASE="http://localhost:4000"
FAILED=0
PASSED=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=== LiquidAI v2.0 Backend API Test Suite ==="
echo "Testing all endpoints at $API_BASE"
echo ""

# Test helper function
test_endpoint() {
    local name=$1
    local url=$2
    local expected_code=$3

    echo -n "Testing $name... "
    response=$(curl -s -w "\n%{http_code}" "$API_BASE$url")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "$expected_code" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC} (Expected HTTP $expected_code, got $http_code)"
        echo "  Response: $body"
        ((FAILED++))
    fi
}

echo "=== Core Health & Status ==="
test_endpoint "Health Check" "/health" "200"
test_endpoint "API Status" "/api/status" "200"
test_endpoint "Prometheus Metrics" "/metrics" "200"

echo ""
echo "=== Pools Endpoints ==="
test_endpoint "List Pools" "/api/pools" "200"

echo ""
echo "=== Protocol Endpoints ==="
test_endpoint "Protocol Stats" "/api/protocol" "200"

echo ""
echo "=== Strategy Endpoints ==="
test_endpoint "List Strategies" "/api/strategy" "200"
test_endpoint "Create Strategy (auth required)" "/api/strategy" "401"

echo ""
echo "=== Positions Endpoints ==="
test_endpoint "List Positions" "/api/positions" "200"

echo ""
echo "=== Analytics Endpoints ==="
test_endpoint "Analytics Data" "/api/analytics" "200"

echo ""
echo "=== Backtest Endpoints ==="
test_endpoint "Backtest List" "/api/backtest" "200"

echo ""
echo "=== Stream Endpoints ==="
test_endpoint "Stream (SSE)" "/api/stream" "200"

echo ""
echo "=== Auth Endpoints ==="
test_endpoint "Auth Challenge" "/api/auth/challenge" "400"  # Missing required params

echo ""
echo "=== Engine Endpoints (v1.3) ==="
test_endpoint "Engine Status (auth required)" "/api/engine" "401"

echo ""
echo "=== Analytics Dashboard (v1.9) ==="
test_endpoint "Analytics Dashboard (auth required)" "/api/analytics/dashboard" "401"
test_endpoint "Emergency Stop (auth required)" "/api/analytics/emergency-stop" "401"
test_endpoint "Policies (auth required)" "/api/analytics/policy" "401"
test_endpoint "Audit Log (auth required)" "/api/analytics/audit" "401"

echo ""
echo "=== Test Summary ==="
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo "Total:  $((PASSED + FAILED))"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}All tests passed! ✓${NC}"
    exit 0
else
    echo -e "\n${RED}Some tests failed! ✗${NC}"
    exit 1
fi