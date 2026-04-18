

# BaseHub Agent v1 — Planner / Executor Architecture Spec

Build an **agent-driven automation system** for BaseHub.
This is **not** a simple chatbot.
This system must let an LLM understand the user’s intent, convert it into structured rules and draft actions, then let the backend validate and execute those actions safely inside BaseHub.

The product already exists.
Do **not** rebuild BaseHub from scratch.
Add this as a new **Agent Mode** inside the current BaseHub architecture and UI.

---

## Core product goal

BaseHub Agent should act like a **personal onchain activity planner and executor** for Base users.

The user can type natural language instructions like:

* “Stay active on BaseHub every day”
* “Do around 200 actions daily with a 0.0025 ETH limit”
* “Trade one token on PumpHub and also do free NFT mints”
* “Only do low-risk activity”
* “Use BaseHub native actions first”

The system should:

1. understand the request
2. convert it into structured constraints and policies
3. generate a draft daily plan
4. generate concrete draft actions
5. require approval when needed
6. execute approved actions safely
7. keep state, logs, and learning history

---

## Very important product constraints

This is **not** a freeform AI assistant.
The LLM must **not** directly perform blockchain logic by itself.

The LLM is only responsible for:

* intent understanding
* policy generation
* plan generation
* action drafting
* reasoning summaries for the user

The backend is responsible for:

* fetching live state
* validating constraints
* generating transaction payloads
* simulating actions
* queueing actions
* executing actions
* updating logs and state

Use a strict separation between:

* **Planner**
* **Executor**
* **State/Context service**
* **Action validation layer**

---

## Main architecture

Implement the system with these layers:

### 1. Agent Chat UI

Use the existing Agent Mode interface.

Tabs:

* Chat
* Wallet
* Plan
* Activity

Buttons:

* Refresh Draft
* Plan Approved
* Start
* Stop

The chat interface should not just answer conversationally.
It should create a **structured draft plan** behind the scenes.

---

### 2. Context Builder Service

Before every LLM planner call, build a structured live context object.

This context should include at minimum:

```ts
type AgentContext = {
  wallet: {
    address: string
    ethBalance: string
    tokenBalances: Array<{
      symbol: string
      address: string
      balance: string
    }>
  }
  usage: {
    todayActionCount: number
    todayGasSpentEth: string
    todayVolumeEth: string
    pendingActions: number
    completedActions: number
    failedActions: number
  }
  limits: {
    dailyActionTarget?: number
    dailyEthBudget?: string
    minIntervalMinutes?: number
    maxSingleTradeEth?: string
  }
  userPolicy: {
    riskMode: "low" | "medium" | "high"
    allowTokenTrading: boolean
    allowFreeMints: boolean
    allowPaidMints: boolean
    allowGames: boolean
    allowBaseHubNativeOnly: boolean
    autoExecuteLowRisk: boolean
    requireApprovalForTrades: boolean
    requireApprovalForMints: boolean
  }
  features: {
    gmGame: boolean
    gnGame: boolean
    coinFlip: boolean
    pumpHubTrading: boolean
    nftMinting: boolean
    autoPlan: boolean
  }
  market: {
    trendingTokens: Array<any>
    newPumpHubTokens: Array<any>
    freeMints: Array<any>
  }
  basehub: {
    supportedActions: SupportedActionDefinition[]
  }
  memory: {
    preferredActions: string[]
    rejectedActions: string[]
    successfulPatterns: string[]
    notes: string[]
  }
}
```

This context must be injected into the planner every time.

---

### 3. Feature / Action Registry

Create a typed registry for everything the agent can do.

Each action should have metadata like:

```ts
type SupportedActionDefinition = {
  actionType: string
  title: string
  description: string
  category: "trade" | "mint" | "game" | "engagement" | "utility"
  riskLevel: "low" | "medium" | "high"
  requiresApproval: boolean
  estimatedCostEth?: string
  supported: boolean
  inputSchema: Record<string, any>
}
```

Examples:

* `play_gm_game`
* `play_gn_game`
* `coin_flip`
* `scan_new_pumphub_tokens`
* `draft_buy_pumphub_token`
* `draft_sell_pumphub_token`
* `scan_free_mints`
* `draft_free_mint`
* `draft_paid_mint`
* `basehub_native_activity`

The LLM must only use actions that exist in this registry.

---

### 4. Intent Parser

User natural language should first be converted into a normalized intent object.

Example:

Input:
“token ve nft trade yap basehub da aktif ol”

Output:

```ts
type ParsedIntent = {
  primaryGoal: string
  goals: string[]
  constraints: {
    dailyActionTarget?: number
    dailyEthBudget?: string
    minIntervalMinutes?: number
    singleTokenOnly?: boolean
    lowRiskOnly?: boolean
  }
  requestedActionTypes: string[]
  requestedAssets?: string[]
  executionMode: "chat_only" | "draft" | "assisted" | "auto"
}
```

This step can be done with LLM or a hybrid parser, but the output must be structured and validated.

---

### 5. Planner

Create a planner module powered by the LLM.

The planner receives:

* parsed intent
* agent context
* action registry

The planner returns strict JSON only.

Use a schema like:

```ts
type DraftPlan = {
  summary: string
  objective: string
  strategy: string[]
  rules: {
    dailyActionTarget?: number
    dailyEthBudget?: string
    minIntervalMinutes?: number
    maxSingleTradeEth?: string
    singleTokenOnly?: boolean
    allowTokenTrading: boolean
    allowFreeMints: boolean
    allowPaidMints: boolean
    allowGames: boolean
    basehubNativePriority: boolean
    riskMode: "low" | "medium" | "high"
  }
  draftActions: DraftAction[]
  warnings: string[]
  requiresApproval: boolean
}
```

And:

```ts
type DraftAction = {
  actionType: string
  title: string
  reason: string
  priority: "low" | "medium" | "high"
  riskLevel: "low" | "medium" | "high"
  estimatedCostEth?: string
  params: Record<string, any>
  requiresApproval: boolean
}
```

The planner must not output plain prose when the system expects machine-readable JSON.

---

### 6. Validation Layer

Every draft action must be validated before queueing.

Validation rules:

* action exists in registry
* params match schema
* respects wallet balance
* respects daily budget
* respects min interval rules
* respects user risk policy
* respects approval requirements

Invalid actions should be rejected and returned with a reason.

---

### 7. Action Queue

Create a persistent queue of actions.

Suggested model:

```ts
type QueuedAction = {
  id: string
  userId: string
  planId?: string
  status: "draft" | "approved" | "scheduled" | "executing" | "completed" | "failed" | "cancelled"
  actionType: string
  title: string
  reason: string
  params: Record<string, any>
  priority: number
  riskLevel: "low" | "medium" | "high"
  estimatedCostEth?: string
  requiresApproval: boolean
  approvedAt?: string
  scheduledFor?: string
  executedAt?: string
  result?: Record<string, any>
  error?: string
}
```

The UI should show:

* waiting for approval
* next action
* completed actions
* failed actions

---

### 8. Executor

The executor must be fully separate from the LLM.

Responsibilities:

* pick next valid action from queue
* re-check current wallet/policy state
* optionally simulate transaction
* build tx payload
* submit tx
* capture tx hash / result
* update queue state
* write activity logs

Never let the LLM submit transactions directly.

---

### 9. Approval Modes

Support these modes:

#### Chat Only

The agent only explains and suggests.

#### Draft Mode

The agent creates plan + draft actions, but executes nothing.

#### Assisted Mode

The agent can auto-run low-risk approved-safe actions only.

#### Full Auto

The agent can run everything allowed by strict user policy.

Approval examples:

* low-risk game actions can be auto-approved
* token trades should usually require approval unless user explicitly opts in
* paid mints should require approval by default

---

### 10. Memory / Learning Layer

Persist lightweight agent memory per user.

Store things like:

* preferred action types
* rejected action types
* last successful routines
* risk tolerance
* favorite tokens
* likes free mints
* wants BaseHub-native actions first

Do not let memory become unbounded.
Use a summarized profile object.

Example:

```ts
type AgentMemory = {
  preferences: {
    prefersFreeMints: boolean
    prefersLowRisk: boolean
    prefersSingleTokenStrategy: boolean
    prefersBaseHubNativeActions: boolean
  }
  history: {
    successfulActionTypes: string[]
    rejectedActionTypes: string[]
    commonBudgetRangeEth?: string
  }
  notes: string[]
}
```

---

## Important system behavior rules

### Rule 1

Never let the LLM hallucinate unsupported actions.

### Rule 2

Never execute actions without current live state.

### Rule 3

Never exceed daily budget or policy limits.

### Rule 4

If user input is vague, produce a conservative draft instead of aggressive execution.

### Rule 5

If balance is too low, propose lower-cost actions instead of failing silently.

### Rule 6

If no valid trade opportunity exists, switch to safer BaseHub-native engagement actions.

### Rule 7

The system should always explain:

* what it plans to do
* why
* expected cost
* whether approval is needed

---

## UX flow

### Chat flow

User sends:
“Do around 212 daily actions, use 0.0025 ETH max, 4-minute intervals, trade one PumpHub token and do free NFT mints.”

System flow:

1. parse intent
2. fetch live context
3. call planner
4. validate actions
5. save draft plan
6. show draft summary in UI

UI should show:

* summary
* daily target
* budget
* interval
* enabled action types
* estimated spend
* risk level
* approval needed

---

### Start flow

When the user clicks Start:

* do not ask LLM what to do again immediately unless needed
* load current approved queue
* begin executor cycle
* mark agent as active
* schedule next runs using interval rules

---

### Refresh Draft flow

When user clicks Refresh Draft:

* fetch latest wallet + market + queue state
* re-run planner with current context
* produce updated draft
* diff old draft vs new draft if possible

---

### Stop flow

When user clicks Stop:

* pause execution
* keep draft and history
* no new actions should execute

---

## Database design

Create tables or models for:

* `agent_profiles`
* `agent_memories`
* `agent_plans`
* `agent_actions`
* `agent_activity_logs`
* `agent_runtime_state`

Suggested plan model:

```ts
type AgentPlanRecord = {
  id: string
  userId: string
  status: "draft" | "approved" | "active" | "paused" | "completed"
  summary: string
  objective: string
  rulesJson: Record<string, any>
  strategyJson: string[]
  warningsJson: string[]
  createdAt: string
  updatedAt: string
}
```

Suggested activity log model:

```ts
type AgentActivityLog = {
  id: string
  userId: string
  actionId?: string
  type: "plan_created" | "action_queued" | "action_approved" | "action_executed" | "action_failed" | "agent_started" | "agent_stopped"
  message: string
  metadata?: Record<string, any>
  createdAt: string
}
```

---

## LLM output requirements

The planner must return JSON only.
Use schema validation with zod or equivalent.
If parsing fails, retry once with a repair prompt.
Do not continue with unstructured output.

Use strong system instructions like:

* You are the BaseHub Agent Planner.
* You translate user goals into strict structured plans.
* You may only use actions from the provided action registry.
* You must obey budget, risk, interval, and approval policies.
* Return valid JSON only.
* Do not output markdown.
* Do not invent action types.

---

## Example planner prompt design

System prompt:

“You are the BaseHub Agent Planner.
Your job is to transform user requests into structured daily onchain action plans for BaseHub.
You must use only the supported actions in the provided registry.
You must obey all user policy limits and live wallet constraints.
If the request is ambiguous, generate a conservative low-risk draft.
Return valid JSON matching the provided schema only.”

Inputs:

* user message
* parsed intent
* agent context
* action registry
* memory summary

Output:

* `DraftPlan`

---

## Example scenario

User says:
“token ve nft trade yap basehub da aktif ol”

Expected plan behavior:

* interpret as daily activity goal
* prioritize BaseHub-supported token activity
* include free NFT mint scanning if available
* keep risk conservative unless user asked for aggressive behavior
* create a small queue of safe starter actions
* require approval for trades unless policy says otherwise

Example draft actions:

* scan new PumpHub tokens
* draft one low-size buy candidate
* scan free mints
* draft one free mint if available
* add one GM/Game action if budget is low or no trading opportunity exists

---

## Example fallback behavior

If ETH balance is too low:

* reduce trade size
* prioritize free or near-zero-cost activity
* warn the user clearly

If no mint is available:

* replace mint action with BaseHub-native low-risk action

If no valid token setup exists:

* keep the trade in draft status and ask for approval or wait for better signal

---

## Engineering requirements

Use TypeScript throughout.

Recommended modules:

* `agent/context-builder.ts`
* `agent/intent-parser.ts`
* `agent/planner.ts`
* `agent/validator.ts`
* `agent/queue.ts`
* `agent/executor.ts`
* `agent/memory.ts`
* `agent/types.ts`

Use zod schemas for:

* parsed intent
* draft plan
* draft action
* queue action
* runtime state

Keep all planner outputs typed and validated.

---

## What not to build

Do not build:

* a generic chatbot
* a fake AI that just replies confidently
* direct LLM transaction execution
* non-persistent in-memory-only planning
* hardcoded one-off demo logic

Build a reusable agent framework for BaseHub.

---

## First implementation milestone

Implement v1 with only these supported actions:

* GM Game
* GN Game
* Coin Flip
* scan free mints
* draft free mint
* scan PumpHub new tokens
* draft buy candidate
* draft sell candidate

Focus on:

* planner
* draft creation
* approval flow
* queue
* executor skeleton
* logs
* persistent state

Do not attempt fully autonomous advanced trading first.

---

## Final product vision

BaseHub Agent should feel like:

* a personal onchain activity operator
* a rules-driven execution assistant
* a safe planner/executor system
* not just an AI chat box

The agent should know:

* the user’s balance
* the user’s limits
* the user’s preferences
* BaseHub features
* what actions are actually possible right now

And it should act only through safe validated backend tools.

---
