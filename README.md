# AgriSmart Solutions

Create a modern web application called "AgriSmart" using React, Tailwind CSS, Lucide icons, and Recharts.

DESIGN TOKENS & STYLE:

- Background: Warm off-white (#FAF7F2)

- Accent: Fresh Mint (#99D5C9)

- Surface: White cards with subtle borders and rounded corners (rounded-2xl)

PAGES & ROUTING:

1. Navigation Header: Brand logo "AgriSmart" with a leaf icon, Links (Home, Dashboard, History, Soil Analyzer, ML Evaluation), Auth Buttons (Login, Sign Up), and User Profile Chip when signed in.

2. Landing Page (/): Hero title "Smart Farming for a Sustainable Future", subtext, "Get Started Free" button, and 4 feature cards (Crop Recommendations, Water Management, Budget Planning, Community Insights).

3. Auth Pages (/login & /register): Centered card forms with email, password, and submission actions.

4. Dashboard (/dashboard): Farmer Input Form (Name, Land Area, Water, Soil Type [Clay, Sandy, Loamy, Silty, Clay Loam], Budget, Preferred Crop, Notes). Output recommendation cards with source badges: "[ML MODEL]" vs "[RULE-BASED]".

5. History (/history): Responsive grid of past saved recommendations.

6. Soil Analyzer (/soil-analysis): Photo upload area displaying probability results with an "EXPERIMENTAL / Dataset Pending" badge.

7. ML Evaluation (/ml-evaluation): Benchmark comparison table (Random Forest, XGBoost, Decision Tree, SVM, Naive Bayes, KNN) displaying Accuracy, Macro F1, and Cross-Validation metrics, alongside a Recharts Feature Importance bar chart.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c5bebc74-1ab4-43ee-8af7-3c1f862883bd).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Repository Architecture

This repository contains three coordinated modules:

1. **Frontend (`src/`):** React 19, TanStack Start, TanStack Router, Tailwind CSS v4, and i18n support.
2. **Machine Learning (`ml/`):** Scikit-Learn Random Forest pipeline, benchmark dataset, training script, and FastAPI inference service (`ml/api/main.py`).
3. **Backend (`backend/`):** Spring Boot 3.3.5 REST API service (Java 17, Spring Web, Spring Data JPA, PostgreSQL). See [`backend/README.md`](file:///f:/agrismart_solutions/agri-wisdom-tool-main/backend/README.md) for startup and configuration.
