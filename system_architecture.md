# Kapuruka AI Sourcing Agent — System Architecture

This document details the system architecture and agent workflows for the **Kapuruka AI Sourcing Agent** (Kapuruka.com AI Mode). The platform utilizes an agentic multi-agent architecture to orchestrate product discovery, cart management, checkout state machine progress, logistics tracking, and home service providers.

---

## 1. System Overview & Architecture

The architecture consists of:

1. **Next.js Edge Endpoint Router** (`src/app/api/chat/route.ts`): The system's main orchestrator. It receives user messages, maintains session DB state, executes intent classification, coordinates the Router Agent, runs the business logic, and streams the responses using Server-Sent Events (SSE).
2. **Intent & Search Classifier (LLM-based)**: Runs a 1st-pass classification to determine query relevance, extract precise search keywords, and identify the user's primary intent (`product`, `delivery`, `service`, `qa`).
3. **Router Agent** (`src/lib/agents/routerAgent.ts`): A specialized LLM-based coordinator that decides which macro action to execute (`shop`, `checkout_start`, `checkout_continue`, `checkout_pause`, `cart_modify`, `checkout_cancel`).
4. **Cart Modifier Agent** (`src/lib/agents/cartModifierAgent.ts`): Parses free-form text to perform structured cart additions, removals, or quantity updates.
5. **Order Agent** (`src/lib/agents/orderAgent.ts`): Handles the conversational checkout state machine and extracts structured parameters like address names, coordinates, and payment methods.
6. **Pillar Tool Layer** (`src/lib/tools.ts`): Interacts with the Kapruka Model Context Protocol (MCP) server, external geocoding interfaces, local home services registries, and Google Search Grounding.

---

## 2. Complete Agent Working Flow

The diagram below represents the complete request lifecycle, showing how incoming messages are parsed, classified, routed, and handled by the specialized agents.

```mermaid
flowchart TD
    %% Styling Classes
    classDef client fill:#E1F5FE,stroke:#0288D1,stroke-width:2px,color:#01579B;
    classDef core fill:#E8F5E9,stroke:#388E3C,stroke-width:2px,color:#1B5E20;
    classDef agent fill:#FFF3E0,stroke:#F57C00,stroke-width:2px,color:#E65100;
    classDef db fill:#ECEFF1,stroke:#455A64,stroke-width:2px,color:#263238;
    classDef ext fill:#F3E5F5,stroke:#7B1FA2,stroke-width:2px,color:#4A148C;

    %% Nodes
    User(["User (Web Client)"]):::ui
    POSTChat["POST /api/chat handler<br/>(src/app/api/chat/route.ts)"]:::core
    DB[("Prisma DB<br/>(Chat Messages, Session, Cart, Orders)")]:::db

    %% Initial flow
    User -->|User Message + Selected Products| POSTChat
    POSTChat -->|1. Save User Message / Fetch History| DB

    %% Intent Classification
    SubGraphIntent["1st Pass: Intent & Search Term Classifier (Gemini)"]:::core
    POSTChat --> SubGraphIntent
    SubGraphIntent -->|Intent: product / delivery / service / qa| POSTChat

    %% Router Agent Decision
    RouterAgent["Router Agent (src/lib/agents/routerAgent.ts)"]:::agent
    POSTChat -->|2. Route Decisions (Context: History + Checkout State)| RouterAgent
    RouterAgent -->|Decides Action| ActionSwitch{"Action?"}:::agent

    %% Action Branches
    ActionSwitch -->|checkout_cancel| CancelHandler["Cancel Checkout Flow"]:::core
    ActionSwitch -->|checkout_start| StartHandler["Start Checkout Flow"]:::core
    ActionSwitch -->|cart_modify| CartModifyHandler["Cart Modification Flow"]:::core
    ActionSwitch -->|checkout_continue| CheckoutContinueHandler["Checkout Progress Flow"]:::core
    ActionSwitch -->|shop / checkout_pause| ShopHandler["Shop / General Q&A Flow"]:::core

    %% Cancel handler details
    CancelHandler -->|Clear checkout state & cart| DB
    CancelHandler -->|Stream 'cancelled' event| User

    %% Start handler details
    StartHandler -->|Load cart| DB
    StartHandler -->|Check Stock| MCPEcommerce["Kapruka MCP Server"]:::ext
    StartHandler -->|Save State: qty_ask| DB
    StartHandler -->|Stream 'qty_ask' event| User

    %% Cart Modify details
    CartModifier["Cart Modifier Agent<br/>(src/lib/agents/cartModifierAgent.ts)"]:::agent
    CartModifyHandler -->|Analyze message & available products| CartModifier
    CartModifier -->|Decide action: add/remove/update_qty| CartModifyHandler
    CartModifyHandler -->|Apply modifications & Save Cart| DB
    CartModifyHandler -->|If addition: Reset phase to 'qty_ask'| DB
    CartModifyHandler -->|Stream updated cart event| User

    %% Checkout Continue details
    OrderAgent["Order Agent<br/>(src/lib/agents/orderAgent.ts)"]:::agent
    CheckoutContinueHandler -->|Process current phase input| OrderAgent
    OrderAgent -->|Extract quantity, address, payment, nextPhase| CheckoutContinueHandler

    CheckoutContinueHandler -->|If address_ask -> map_open| Geocoding["Google Geocoding API"]:::ext
    CheckoutContinueHandler -->|If payment_ask -> confirmed| OrderAPI["POST /api/order"]:::core
    OrderAPI -->|Place Order via MCP| MCPEcommerce
    OrderAPI -->|Save Order & Clear Cart| DB

    CheckoutContinueHandler -->|Update Checkout State| DB
    CheckoutContinueHandler -->|Stream next phase event| User

    %% Shop Handler details
    ShopHandler -->|Pillar 1: Product Search| SearchProducts["searchProducts MCP"]:::ext
    ShopHandler -->|Pillar 6: Category Browse| CategoryAgent["Category Browse Agent (Gemini)"]:::agent
    CategoryAgent -->|Extract Subcategories| Scraper["Cheerio HTML Scraper"]:::core
    SearchProducts --> RelevanceCheck["Gemini Validator"]:::core
    Scraper -->|Merge & Deduplicate by Concept| RelevanceCheck
    RelevanceCheck --> ShopHandler
    ShopHandler -->|Pillar 2: Logistics| LogisticsAPI["Grasshoppers Logistics MCP"]:::ext
    ShopHandler -->|Pillar 3: SME / Partner Central| SMETagging["SME Tagging & Sorting"]:::core
    ShopHandler -->|Pillar 5: Home Services| ServiceRegistry["Local Service Registry (Stub)"]:::core
    ShopHandler -->|Pillar 4 / QA: Google Grounding| GroundingSearch["Google Search (Gemini Grounding)"]:::ext

    LogisticsAPI --> ShopHandler
    SMETagging --> ShopHandler
    ServiceRegistry --> ShopHandler
    GroundingSearch --> ShopHandler

    ShopHandler -->|Generate Structured Stream<br/>(Tags: INTRO / DETAILS)| User
    ShopHandler -->|Save Response & Product Groups| DB
```

---

## 3. Conversational Checkout State Machine

The checkout lifecycle is modeled as a state machine managed cooperatively by the **Router Agent** (directing input to continue or pause), **Order Agent** (evaluating phase answers and deciding transitions), and **Next.js Handler** (handling API/DB actions).

```mermaid
stateDiagram-v2
    [*] --> qty_ask : User initiates checkout (checkout_start)

    qty_ask --> qty_ask : User changes quantity or is unclear (stay=true)
    qty_ask --> delivery_ask : User confirms quantity

    delivery_ask --> payment_ask : User chooses Saved Address
    delivery_ask --> address_ask : User chooses New Address
    delivery_ask --> delivery_ask : Unclear (stay=true)

    address_ask --> map_open : User inputs address (Geocoding executes)

    map_open --> payment_ask : User confirms map pin location (UI event)

    payment_ask --> confirmed : User selects payment method (COD or Card) / Order Placed
    payment_ask --> payment_ask : Unclear (stay=true)

    confirmed --> [*]

    %% External triggers
    qty_ask --> [*] : Cancel Checkout (checkout_cancel)
    delivery_ask --> [*] : Cancel Checkout
    address_ask --> [*] : Cancel Checkout
    map_open --> [*] : Cancel Checkout
    payment_ask --> [*] : Cancel Checkout
```

---

## 4. Component Details & Design Decisions

### A. Intent & Search Classification

The classification block acts as a gateway to check queries against safety guidelines, detect product nouns, and extract price limits. This prevents unrelated prompts (e.g. coding requests) from using token resources on product database queries. It also identifies when a user is making a broad/generic query (e.g., "flowers", "anniversary gifts") and routes them to the Category Browse pillar.

### B. The Router Agent (`routerAgent.ts`)

Operating entirely without regex rules, this agent determines the action based on the state. For example:

- **`checkout_pause`**: Occurs if the user is in the middle of checking out but asks a question like _"What is the return policy?"_. The agent pauses the checkout state machine, handles the support query in the shop loop, and keeps the cart active so they can resume later.

### C. Cart Modifier Agent (`cartModifierAgent.ts`)

Translates unstructured user intents (_"remove the second item"_, _"add the cake"_) into structured changes. It pulls historical context from the last 5 assistant messages to know what products were recently viewed and available for addition.

### D. Order Agent (`orderAgent.ts`)

Maintains conversation rules and extracts fields:

- `addressText`: Cleaned of conversational elements.
- `paymentMethod`: Classified into `"cod"` or `"card"`.
- It prompts the geocoder when transitioning from `address_ask` to `map_open`, positioning the user's interactive map interface accurately.

### E. Category Browse Agent (`categoryBrowseAgent.ts`)

For broad exploratory queries, this agent evaluates the user's request against a cached Kapruka category tree. 
- It selects the 1-3 best subcategories.
- It performs **Semantic Concept Grouping** by combining similar subcategories (e.g., "Love and Romance" and "Flower Bouquets") into a single "Flowers" group. This prevents the UI from rendering duplicate components for the same conceptual item.

### F. Multi-Pillar Integrations

- **Pillar 1 (Domestic Catalog)**: Employs parallel variant query matching followed by a Gemini validation step (`llmValidateRelevance`). The validator assigns a `relevance_score` (1-100) to each product, sorting the highest matches to the top.
- **Pillar 6 (Category Browse)**: Scrapes Kapruka categories via Cheerio, extracting DOM/JSON-LD data. It dynamically disables discard constraints on the AI relevance validator to heavily aggressively filter out mismatched scraped items. Merged semantic groups are deduplicated by ID to ensure distinct UI rendering.
- **Pillar 2 (Grasshoppers Logistics)**: Accesses live availability timelines, rates, and tracking updates.
- **Pillar 3 (SME / Partner Central)**: Highlights small local businesses using artisan keyword matching.
- **Pillar 5 (Services)**: Maps queries to verified Sri Lankan technicians (electricians, plumbers, AC, cleaning, pest, paint, carpentry) filtered by target cities.
- **Q&A Grounding**: Utilizes Gemini Google Search tool features to answer questions about platform policies, refunds, or general queries.
