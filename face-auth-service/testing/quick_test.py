#!/usr/bin/env python3
"""
Simple Quick Test Script for Backend Face Auth API
Basic functionality testing without complex logic.
"""

import requests
import sys

# Configuration
BACKEND_URL = "http://localhost:3000/api"
TEST_USER = {
  "username": "john_doe",
  "password": "password123",
  "confirmPassword": "password123"
}

def get_jwt_token():
    """Get JWT token by login or register."""
    print("🔑 Getting JWT token...")
    
    # Try login first
    login_response = requests.post(f"{BACKEND_URL}/auth/login", json={
        "username": TEST_USER["username"],
        "password": TEST_USER["password"]
    })
    
    if login_response.status_code == 200:
        token = login_response.json()["access_token"]
        print("✅ Login successful")
        return token
    
    # If login fails, try register
    register_response = requests.post(f"{BACKEND_URL}/auth/register", json=TEST_USER)
    
    if register_response.status_code == 201:
        token = register_response.json()["access_token"]
        print("✅ Registration successful")
        return token
    
    print("❌ Failed to get token")
    return None

def test_health():
    """Test backend health."""
    print("\n🏥 Testing backend health...")
    try:
        response = requests.get("http://localhost:3000/docs")
        if response.status_code == 200:
            print("✅ Backend is healthy")
            return True
        else:
            print(f"❌ Backend health failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Backend not reachable: {e}")
        return False

def test_face_status(token):
    """Test face auth status."""
    print("\n📊 Testing face auth status...")
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.get(f"{BACKEND_URL}/face-auth/status", headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Status: {result['status']}")
            print(f"🤖 Model ready: {result['model_ready']}")
            return result
        else:
            print(f"❌ Error: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Request failed: {e}")
        return None

def test_face_delete(token):
    """Test face data deletion."""
    print("\n🗑️ Testing face data deletion...")
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.delete(f"{BACKEND_URL}/face-auth/delete", headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Deletion: {result['message']}")
            return True
        else:
            print(f"❌ Error: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Request failed: {e}")
        return False

def main():
    """Main test function."""
    print("⚡ Simple Backend Face Auth Test")
    print("=" * 40)
    
    # Test backend health
    if not test_health():
        return
    
    # Get JWT token
    token = get_jwt_token()
    if not token:
        return
    
    # Test face auth endpoints
    test_face_status(token)
    
    # Optional: clean up existing data
    if len(sys.argv) > 1 and sys.argv[1] == "clean":
        test_face_delete(token)
    
    print("\n🎉 Simple test completed!")

if __name__ == "__main__":
    main()