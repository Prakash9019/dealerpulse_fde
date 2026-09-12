import httpx

import tools


def test_call_tool_returns_error_dict_when_service_unreachable(httpx_mock):
    httpx_mock.add_exception(httpx.ConnectError("connection refused"))
    result = tools._call_tool("get_network_kpis", {"range": "all"})
    assert result["error"] == "tool_unreachable"
    assert result["name"] == "get_network_kpis"


def test_call_tool_returns_result_on_success(httpx_mock):
    httpx_mock.add_response(json={"result": {"kpi": {"units": 160}}})
    result = tools._call_tool("get_network_kpis", {"range": "all"})
    assert result == {"kpi": {"units": 160}}


def test_all_tools_are_registered():
    names = {t.name for t in tools.ALL_TOOLS}
    assert names == {
        "get_network_kpis", "get_branch_performance", "get_rep_performance",
        "get_funnel_metrics", "get_lead_aging", "get_revenue_at_risk",
        "get_forecast", "get_anomalies", "run_scenario",
    }
