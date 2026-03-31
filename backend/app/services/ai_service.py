"""
services/ai_service.py

Handles all AI-powered features using the Anthropic Claude API.
Make sure to add your API key to .env:
  ANTHROPIC_API_KEY=your_key_here

This service powers:
  1. Customer support chatbot
  2. Personalized subscription suggestions
  3. Monthly AI spending report
  4. AI-powered promo/deal hunting (via web search prompt)
"""

import os
import httpx
from dotenv import load_dotenv
from app.models.subscription import Subscription

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
CLAUDE_API_URL = "https://api.anthropic.com/v1/messages"
MODEL = "claude-sonnet-4-20250514"

HEADERS = {
    "x-api-key": ANTHROPIC_API_KEY,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json"
}


def format_subscriptions_for_prompt(subscriptions: list[Subscription]) -> str:
    """
    Converts subscription objects into a clean text summary for AI prompts.
    """
    if not subscriptions:
        return "No subscriptions found."

    lines = []
    for sub in subscriptions:
        cycle = sub.billing_cycle
        lines.append(
            f"- {sub.name} ({sub.category}): ${sub.price:.2f}/{cycle}"
        )
    return "\n".join(lines)


async def ask_support_chatbot(user_message: str, conversation_history: list[dict]) -> str:
    """
    Customer support chatbot.
    Maintains conversation history for multi-turn chat.

    conversation_history format:
    [
        {"role": "user", "content": "How do I add a subscription?"},
        {"role": "assistant", "content": "To add a subscription..."}
    ]

    Add the new user message to history before calling this function,
    then append the response to history after.
    """
    system_prompt = """You are a friendly and helpful customer support assistant for Subtrackr, 
a subscription tracking app. Help users with questions about:
- Adding, editing, or deleting subscriptions
- Understanding their spending summaries
- Setting up alerts and reminders
- Navigating the app
- General subscription management tips

Keep responses concise, friendly, and practical. If a user asks something 
unrelated to Subtrackr or subscription management, gently redirect them."""

    async with httpx.AsyncClient() as client:
        response = await client.post(
            CLAUDE_API_URL,
            headers=HEADERS,
            json={
                "model": MODEL,
                "max_tokens": 512,
                "system": system_prompt,
                "messages": conversation_history + [
                    {"role": "user", "content": user_message}
                ]
            },
            timeout=30.0
        )
        data = response.json()
        if "content" not in data:
            raise Exception(f"API error: {data}")
        return data["content"][0]["text"]


async def get_subscription_suggestions(subscriptions: list[Subscription], monthly_income: float) -> str:
    """
    Analyzes the user's subscriptions and returns personalized suggestions.
    Looks for overlaps, high spending, forgotten services, and bundling opportunities.
    """
    sub_summary = format_subscriptions_for_prompt(subscriptions)
    total = sum(
        s.price if s.billing_cycle == "monthly" else s.price / 12
        for s in subscriptions
    )
    spending_pct = (total / monthly_income * 100) if monthly_income > 0 else 0

    prompt = f"""Here are a user's current subscriptions:

{sub_summary}

Monthly income: ${monthly_income:.2f}
Total monthly subscription spend: ${total:.2f} ({spending_pct:.1f}% of income)

Please analyze their subscriptions and provide:
1. Any overlapping services they could consolidate (e.g., multiple streaming services)
2. Bundling opportunities (e.g., Disney+/Hulu/ESPN bundle)
3. Any subscriptions that seem redundant
4. A general assessment of whether their spending is healthy
5. 2-3 specific, actionable money-saving recommendations

Keep the tone friendly and non-judgmental. Be specific with service names."""

    async with httpx.AsyncClient() as client:
        response = await client.post(
            CLAUDE_API_URL,
            headers=HEADERS,
            json={
                "model": MODEL,
                "max_tokens": 800,
                "messages": [{"role": "user", "content": prompt}]
            },
            timeout=30.0
        )
        data = response.json()
        return data["content"][0]["text"]


async def generate_monthly_report(subscriptions: list[Subscription], monthly_income: float) -> str:
    """
    Generates a natural language monthly spending report.
    Call this once a month per user (tie to a scheduler job or on-demand endpoint).
    """
    sub_summary = format_subscriptions_for_prompt(subscriptions)
    total_monthly = sum(
        s.price if s.billing_cycle == "monthly" else s.price / 12
        for s in subscriptions
    )
    total_annual = total_monthly * 12
    spending_pct = (total_monthly / monthly_income * 100) if monthly_income > 0 else 0

    # Group by category
    categories: dict[str, float] = {}
    for sub in subscriptions:
        cost = sub.price if sub.billing_cycle == "monthly" else sub.price / 12
        categories[sub.category] = categories.get(sub.category, 0) + cost

    category_summary = "\n".join(
        f"- {cat}: ${amt:.2f}/month" for cat, amt in categories.items()
    )

    prompt = f"""Generate a friendly, conversational monthly subscription spending report for a user.

Their subscriptions:
{sub_summary}

Spending by category:
{category_summary}

Total monthly: ${total_monthly:.2f} ({spending_pct:.1f}% of their ${monthly_income:.2f} monthly income)
Total annual projection: ${total_annual:.2f}

Write a short, warm report (3-4 paragraphs) that:
1. Summarizes their spending in plain english
2. Highlights their biggest spending category
3. Gives one encouraging or actionable insight
4. Ends with a positive, motivating note about managing subscriptions

Do NOT use bullet points. Write it like a friendly financial advisor talking to them directly."""

    async with httpx.AsyncClient() as client:
        response = await client.post(
            CLAUDE_API_URL,
            headers=HEADERS,
            json={
                "model": MODEL,
                "max_tokens": 600,
                "messages": [{"role": "user", "content": prompt}]
            },
            timeout=30.0
        )
        data = response.json()
        return data["content"][0]["text"]


async def find_deals_for_subscription(subscription_name: str, current_price: float) -> str:
    """
    Asks Claude to find current deals, cheaper tiers, or alternatives
    for a specific subscription service.

    Note: Claude's knowledge has a cutoff date. For truly real-time deals,
    consider integrating a web search API (e.g., Serper, Brave Search) and
    passing the results into this prompt as context.
    """
    prompt = f"""A user is currently paying ${current_price:.2f} for {subscription_name}.

Please provide:
1. Any known cheaper pricing tiers for {subscription_name} (e.g., ad-supported plans)
2. Any common promotional offers or student/annual discounts
3. 2-3 alternative services that offer similar value at a lower price
4. A quick tip on how to negotiate or find a better deal

Be specific and practical. If you're unsure of exact current pricing, say so and suggest 
the user verify on the service's website."""

    async with httpx.AsyncClient() as client:
        response = await client.post(
            CLAUDE_API_URL,
            headers=HEADERS,
            json={
                "model": MODEL,
                "max_tokens": 500,
                "messages": [{"role": "user", "content": prompt}]
            },
            timeout=30.0
        )
        data = response.json()
        if "content" not in data:
            raise Exception(f"API error: {data}")
        return data["content"][0]["text"]