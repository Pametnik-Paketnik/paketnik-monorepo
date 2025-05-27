#!/usr/bin/env python3
"""
Debug script to check import issues
"""

import sys
import os
from pathlib import Path

def check_files_and_imports():
    print("🔍 DEBUGGING IMPORT ISSUES")
    print("=" * 50)
    
    # Check current directory
    current_dir = Path.cwd()
    print(f"📁 Current directory: {current_dir}")
    
    # List all Python files
    python_files = list(current_dir.glob("*.py"))
    print(f"\n📄 Python files in current directory:")
    for file in python_files:
        print(f"   - {file.name}")
    
    # Check for specific files
    target_files = [
        "smart_box_face_auth.py",
        "smart_box_simple_final.py",
        "test_simple_script.py"
    ]
    
    print(f"\n🎯 Checking for target files:")
    existing_files = []
    for file in target_files:
        file_path = current_dir / file
        exists = file_path.exists()
        print(f"   {'✅' if exists else '❌'} {file}")
        if exists:
            existing_files.append(file_path)
            # Check file size
            size = file_path.stat().st_size
            print(f"      Size: {size} bytes")
            
            # Check if file is readable
            try:
                with open(file_path, 'r') as f:
                    first_line = f.readline().strip()
                print(f"      First line: {first_line}")
            except Exception as e:
                print(f"      ❌ Cannot read file: {e}")
    
    if not existing_files:
        print(f"\n❌ No target files found!")
        print(f"💡 You need to create the files first")
        return False
    
    # Try to import from each existing file
    print(f"\n🧪 TESTING IMPORTS")
    print("-" * 30)
    
    for file_path in existing_files:
        module_name = file_path.stem  # filename without .py
        print(f"\n📦 Testing import from: {module_name}")
        
        try:
            # Add current directory to path if not already there
            if str(current_dir) not in sys.path:
                sys.path.insert(0, str(current_dir))
            
            # Try to import the module
            if module_name in sys.modules:
                # Remove from cache to test fresh import
                del sys.modules[module_name]
            
            module = __import__(module_name)
            print(f"   ✅ Module imported successfully")
            
            # Check if SmartBoxFaceAuth class exists
            if hasattr(module, 'SmartBoxFaceAuth'):
                print(f"   ✅ SmartBoxFaceAuth class found")
                
                # Try to instantiate (this will test for syntax errors)
                try:
                    # Just test class definition, don't actually initialize
                    cls = getattr(module, 'SmartBoxFaceAuth')
                    print(f"   ✅ SmartBoxFaceAuth class can be accessed")
                    print(f"   📋 Class methods: {[m for m in dir(cls) if not m.startswith('_')][:5]}...")
                    return True
                except Exception as e:
                    print(f"   ❌ Error accessing SmartBoxFaceAuth class: {e}")
            else:
                print(f"   ❌ SmartBoxFaceAuth class not found in module")
                print(f"   📋 Available attributes: {[attr for attr in dir(module) if not attr.startswith('_')]}")
                
        except ImportError as e:
            print(f"   ❌ Import failed: {e}")
        except SyntaxError as e:
            print(f"   ❌ Syntax error in file: {e}")
            print(f"   📍 Line {e.lineno}: {e.text}")
        except Exception as e:
            print(f"   ❌ Other error: {e}")
    
    return False

def check_dependencies():
    """Check if required packages are installed"""
    print(f"\n🔧 CHECKING DEPENDENCIES")
    print("-" * 30)
    
    required_packages = [
        'cv2',
        'numpy', 
        'sklearn',
        'keras_vggface',
        'tensorflow'
    ]
    
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package)
            print(f"   ✅ {package}")
        except ImportError:
            print(f"   ❌ {package} - NOT INSTALLED")
            missing_packages.append(package)
    
    if missing_packages:
        print(f"\n💡 Install missing packages:")
        if 'cv2' in missing_packages:
            print(f"   pip install opencv-python")
        if 'sklearn' in missing_packages:
            print(f"   pip install scikit-learn")
        if 'keras_vggface' in missing_packages:
            print(f"   pip install keras-vggface")
        if 'tensorflow' in missing_packages:
            print(f"   pip install tensorflow")
        if 'numpy' in missing_packages:
            print(f"   pip install numpy")
    
    return len(missing_packages) == 0

def create_minimal_test():
    """Create a minimal test file to verify basic import works"""
    print(f"\n🛠️ CREATING MINIMAL TEST")
    print("-" * 30)
    
    minimal_code = '''#!/usr/bin/env python3
"""
Minimal test class
"""

class SmartBoxFaceAuth:
    def __init__(self):
        print("SmartBoxFaceAuth initialized!")
    
    def test_method(self):
        return "Test successful!"

print("Module loaded successfully!")
'''
    
    test_file = Path("test_minimal.py")
    
    try:
        with open(test_file, 'w') as f:
            f.write(minimal_code)
        
        print(f"✅ Created {test_file}")
        
        # Test import
        try:
            import test_minimal
            auth = test_minimal.SmartBoxFaceAuth()
            result = auth.test_method()
            print(f"✅ Minimal test passed: {result}")
            
            # Clean up
            test_file.unlink()
            if 'test_minimal' in sys.modules:
                del sys.modules['test_minimal']
            
            return True
            
        except Exception as e:
            print(f"❌ Minimal test failed: {e}")
            return False
            
    except Exception as e:
        print(f"❌ Could not create test file: {e}")
        return False

if __name__ == "__main__":
    print("Starting import debugging...\n")
    
    # Check files and imports
    import_ok = check_files_and_imports()
    
    # Check dependencies
    deps_ok = check_dependencies()
    
    # If imports failed, try minimal test
    if not import_ok:
        minimal_ok = create_minimal_test()
        
        if minimal_ok:
            print(f"\n💡 Python imports work fine. The issue is likely:")
            print(f"   1. Syntax error in your SmartBoxFaceAuth file")
            print(f"   2. Missing dependencies")
            print(f"   3. File corruption")
        else:
            print(f"\n💡 Basic Python imports are broken. Check:")
            print(f"   1. Python installation")
            print(f"   2. File permissions")
            print(f"   3. Directory permissions")
    
    print(f"\n{'='*50}")
    print(f"✅ Debug completed!")
    
    if not import_ok:
        print(f"\n🔧 QUICK FIX:")
        print(f"   1. Check the syntax of your .py files")
        print(f"   2. Make sure all required packages are installed")
        print(f"   3. Try creating a simple test file first")