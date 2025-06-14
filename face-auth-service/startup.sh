#!/bin/bash
set -e

echo "🚀 Starting Face Auth Service..."

# Check if required environment variables are set
echo "🔍 Checking Kaggle credentials..."
MISSING_CREDS=false

if [ -z "$KAGGLE_USERNAME" ]; then
    echo "❌ KAGGLE_USERNAME not set"
    MISSING_CREDS=true
fi
if [ -z "$KAGGLE_KEY" ]; then
    echo "❌ KAGGLE_KEY not set"
    MISSING_CREDS=true
fi
if [ -z "$KAGGLE_DATASET_NAME" ]; then
    echo "❌ KAGGLE_DATASET_NAME not set"
    MISSING_CREDS=true
fi

if [ "$MISSING_CREDS" = true ]; then
    echo ""
    echo "⚠️  Kaggle test credentials missing! Please check your .env.dev file:"
    echo "   KAGGLE_USERNAME=your_kaggle_username"
    echo "   KAGGLE_KEY=your_kaggle_api_key"
    echo "   KAGGLE_DATASET_NAME=your_username/your-dataset-name"
    echo ""
    echo "🔗 Get credentials from: https://www.kaggle.com/account"
    echo "📋 Continuing without dataset download..."
else
    echo "✅ All Kaggle credentials found"
    echo "👤 Username: $KAGGLE_USERNAME"
    echo "📊 Dataset: $KAGGLE_DATASET_NAME"
fi

# Download dataset if credentials are provided and data doesn't exist
if [ -n "$KAGGLE_DATASET_NAME" ] && [ -n "$KAGGLE_USERNAME" ] && [ -n "$KAGGLE_KEY" ] && [ ! -f "/app/data/.downloaded" ]; then
    echo ""
    echo "📥 Downloading private dataset from Kaggle..."
    python download_dataset.py
    
    # Mark as downloaded to avoid re-downloading on restart
    touch /app/data/.downloaded
    echo "✅ Dataset download complete!"
else
    if [ -f "/app/data/.downloaded" ]; then
        echo "ℹ️  Dataset already downloaded, skipping..."
    else
        echo "⚠️  Skipping dataset download (missing credentials or already exists)"
    fi
fi

echo ""
echo "🎯 Starting uvicorn server..."
exec uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload 