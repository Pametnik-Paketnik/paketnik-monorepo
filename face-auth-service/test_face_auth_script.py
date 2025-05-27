#!/usr/bin/env python3
"""
Test script for Face Authentication system
Works directly with processed images - no face_preprocessing module needed
"""

import cv2
import os
import sys
import json
import numpy as np
from datetime import datetime
from pathlib import Path
import logging
import argparse
import random
from typing import List, Dict, Tuple

# Try to import matplotlib for visualization (optional)
try:
    import matplotlib.pyplot as plt
    import seaborn as sns
    MATPLOTLIB_AVAILABLE = True
except ImportError:
    MATPLOTLIB_AVAILABLE = False

# Import our simplified authentication system
try:
    # Try different possible names for the main module
    try:
        from smart_box_face_auth import SmartBoxFaceAuth
    except ImportError:
        try:
            from smart_box_face_auth import SmartBoxFaceAuth
        except ImportError:
            # If both fail, give clear instructions
            raise ImportError("SmartBoxFaceAuth module not found")
            
except ImportError:
    print("❌ Error: Cannot import SmartBoxFaceAuth module")
    print("Make sure one of these files exists in the same directory:")
    print("   - smart_box_simple_final.py")
    print("   - smart_box_face_auth.py")
    print("\nYou need to copy the SmartBoxFaceAuth code and save it as one of these files.")
    sys.exit(1)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class FaceAuthTester:
    def __init__(self, data_root="data", confidence_threshold=0.75):
        self.data_root = Path(data_root)
        self.results_dir = self.data_root / "test_results"
        self.results_dir.mkdir(exist_ok=True)
        
        # Initialize face auth system
        self.auth_system = SmartBoxFaceAuth(
            data_root=str(self.data_root),
            confidence_threshold=confidence_threshold
        )
        
        self.test_results = []
        
        logger.info("✅ Test system initialized")
        logger.info(f"📁 Data root: {self.data_root}")
        logger.info(f"🎯 Confidence threshold: {confidence_threshold}")
    
    def list_available_users(self):
        """List all users with processed images"""
        print(f"\n🔍 Checking for users in: {self.auth_system.processed_dir}")
        
        users = self.auth_system.list_available_users()
        
        if users:
            print(f"\n📋 Available users for registration:")
            for i, user in enumerate(users, 1):
                processed_dir = self.auth_system.processed_dir / user
                image_count = len(list(processed_dir.glob("*.jpg")) + list(processed_dir.glob("*.png")))
                print(f"   {i}. {user} ({image_count} images)")
        else:
            print(f"\n❌ No users found with processed images")
            print(f"📁 Checked directory: {self.auth_system.processed_dir}")
            
            # Suggest possible locations
            current_dir = Path.cwd()
            possible_locations = [
                current_dir / "data" / "processed",
                current_dir / "scripts" / "data" / "processed",
                current_dir.parent / "data" / "processed",
                current_dir / ".." / "scripts" / "data" / "processed"
            ]
            
            print(f"\n💡 Possible locations for processed images:")
            for loc in possible_locations:
                abs_loc = loc.resolve()
                exists = abs_loc.exists()
                print(f"   {'✅' if exists else '❌'} {abs_loc}")
                if exists:
                    user_dirs = [d for d in abs_loc.iterdir() if d.is_dir()]
                    if user_dirs:
                        print(f"      👥 Found users: {[d.name for d in user_dirs]}")
            
            print(f"\n🔧 Suggestions:")
            print(f"   1. Run face_preprocessing.py to process images")
            print(f"   2. Use --data-root parameter with correct path")
            print(f"   3. Check directory structure")
        
        return users
    
    def register_user(self, user_id: str) -> bool:
        """Register user from processed images"""
        logger.info(f"🎬 Registering user: {user_id}")
        
        # Check if user exists
        available_users = self.auth_system.list_available_users()
        if user_id not in available_users:
            logger.error(f"❌ User {user_id} not found in processed directory")
            logger.info(f"💡 Available users: {available_users}")
            return False
        
        # Register user
        result = self.auth_system.register_user_from_processed_images(user_id)
        
        if result.get("success", False):
            logger.info(f"✅ Registration successful!")
            logger.info(f"   📸 Processed images: {result.get('images_processed', 0)}")
            logger.info(f"   🧠 Embeddings: {result.get('embeddings_extracted', 0)}")
            logger.info(f"   🤖 Classifier trained: {result.get('classifier_trained', False)}")
            return True
        else:
            logger.error(f"❌ Registration failed: {result.get('error', 'Unknown error')}")
            return False
    
    def register_multiple_users(self, user_ids: List[str]) -> Dict:
        """Register multiple users at once"""
        results = {
            "successful": [],
            "failed": [],
            "total": len(user_ids)
        }
        
        for user_id in user_ids:
            if self.register_user(user_id):
                results["successful"].append(user_id)
            else:
                results["failed"].append(user_id)
        
        logger.info(f"📊 Registration completed:")
        logger.info(f"   ✅ Successful: {len(results['successful'])}")
        logger.info(f"   ❌ Failed: {len(results['failed'])}")
        
        return results
    
    def test_single_image(self, image_path: str, expected_user: str = None) -> Dict:
        """Test single image"""
        logger.info(f"🧪 Testing image: {Path(image_path).name}")
        
        if not Path(image_path).exists():
            return {
                "success": False,
                "error": f"Image not found: {image_path}",
                "image_path": image_path
            }
        
        # Authenticate
        auth_result = self.auth_system.authenticate_user(image_path, method='image')
        
        # Prepare result
        result = {
            "image_path": image_path,
            "image_name": Path(image_path).name,
            "success": auth_result.get('success', False),
            "predicted_user": auth_result.get('user_id'),
            "confidence": auth_result.get('confidence', 0.0),
            "threshold": auth_result.get('threshold', 0.0),
            "expected_user": expected_user,
            "correct_prediction": None,
            "error": auth_result.get('error')
        }
        
        # Check prediction correctness
        if expected_user:
            result["correct_prediction"] = (
                result["success"] and 
                result["predicted_user"] == expected_user
            )
        
        # Print result
        if result["success"]:
            status = "✅" if result.get("correct_prediction", True) else "⚠️"
            logger.info(f"{status} Recognized: {result['predicted_user']} (confidence: {result['confidence']:.3f})")
        else:
            logger.info(f"❌ Not recognized: {result['error']}")
        
        return result
    
    def test_from_directory(self, test_dir: str, expected_user: str = None) -> Dict:
        """Test all images from directory"""
        test_path = Path(test_dir)
        if not test_path.exists():
            logger.error(f"❌ Test directory does not exist: {test_dir}")
            return {"success": False, "error": "Directory not found"}
        
        # Find all images
        image_extensions = ['*.jpg', '*.jpeg', '*.png', '*.bmp']
        image_files = []
        for ext in image_extensions:
            image_files.extend(test_path.glob(ext))
            image_files.extend(test_path.glob(ext.upper()))
        
        if not image_files:
            logger.error(f"❌ No images found in {test_dir}")
            return {"success": False, "error": "No images found"}
        
        logger.info(f"🔍 Testing {len(image_files)} images from {test_dir}")
        
        results = {
            "total_tests": len(image_files),
            "successful_auths": 0,
            "failed_auths": 0,
            "correct_predictions": 0,
            "incorrect_predictions": 0,
            "confidences": [],
            "detailed_results": []
        }
        
        for img_path in image_files:
            result = self.test_single_image(str(img_path), expected_user)
            results["detailed_results"].append(result)
            
            if result["success"]:
                results["successful_auths"] += 1
                results["confidences"].append(result["confidence"])
                
                if result.get("correct_prediction") is True:
                    results["correct_predictions"] += 1
                elif result.get("correct_prediction") is False:
                    results["incorrect_predictions"] += 1
            else:
                results["failed_auths"] += 1
        
        # Calculate statistics
        if results["total_tests"] > 0:
            results["success_rate"] = results["successful_auths"] / results["total_tests"]
            results["accuracy"] = results["correct_predictions"] / results["total_tests"] if expected_user else None
            results["avg_confidence"] = np.mean(results["confidences"]) if results["confidences"] else 0
            results["min_confidence"] = min(results["confidences"]) if results["confidences"] else 0
            results["max_confidence"] = max(results["confidences"]) if results["confidences"] else 0
        
        # Print summary
        logger.info(f"📊 Test results:")
        logger.info(f"   🎯 Authentication success rate: {results['success_rate']:.1%}")
        if expected_user:
            logger.info(f"   🎯 Recognition accuracy: {results['accuracy']:.1%}")
        logger.info(f"   📈 Average confidence: {results['avg_confidence']:.3f}")
        logger.info(f"   ✅ Successful: {results['successful_auths']}")
        logger.info(f"   ❌ Failed: {results['failed_auths']}")
        
        return results
    
    def interactive_test(self):
        """Interactive test - user can load images and check results"""
        logger.info("🎮 Interactive authentication test")
        logger.info("Enter image path for testing (or 'quit' to exit)")
        
        # Suggest test image if it exists
        test_image_path = self.data_root.parent / "scripts" / "data" / "testimage"
        if test_image_path.exists():
            # Find images in testimage directory
            image_files = []
            for ext in ['*.jpg', '*.jpeg', '*.png', '*.bmp']:
                image_files.extend(test_image_path.glob(ext))
                image_files.extend(test_image_path.glob(ext.upper()))
            
            if image_files:
                print(f"\n💡 Suggested test images in {test_image_path}:")
                for img in image_files[:5]:  # Show first 5
                    print(f"   - {img}")
        
        while True:
            try:
                img_path = input("\n📷 Image path (or 'quit'): ").strip()
                
                if img_path.lower() in ['quit', 'exit', 'q']:
                    break
                
                if not img_path:
                    continue
                
                # Check if file exists
                if not Path(img_path).exists():
                    print(f"❌ File {img_path} does not exist!")
                    continue
                
                print(f"🔍 Analyzing image: {Path(img_path).name}")
                
                # Test image
                result = self.test_single_image(img_path)
                
                # Display results
                print("\n" + "="*60)
                if result["success"]:
                    print(f"✅ AUTHENTICATION SUCCESSFUL!")
                    print(f"👤 Recognized user: {result['predicted_user']}")
                    print(f"🎯 Confidence: {result['confidence']:.3f}")
                    print(f"📊 Threshold: {result['threshold']:.3f}")
                    
                    # Additional feedback
                    if result["confidence"] > 0.9:
                        print(f"💪 Very confident recognition!")
                    elif result["confidence"] > 0.8:
                        print(f"👍 Reliable recognition")
                    else:
                        print(f"⚠️ Weak recognition - check image quality")
                        
                else:
                    print(f"❌ AUTHENTICATION FAILED")
                    if result.get("confidence"):
                        print(f"🎯 Confidence: {result['confidence']:.3f}")
                        print(f"📊 Threshold: {result['threshold']:.3f}")
                        print(f"💡 Confidence too low for successful authentication")
                    
                    if result.get("error"):
                        print(f"⚠️ Error: {result['error']}")
                        
                        if "No face detected" in result['error']:
                            print(f"💡 Suggestions:")
                            print(f"   - Make sure face is clearly visible")
                            print(f"   - Improve lighting")
                            print(f"   - Use sharp image")
                
                print("="*60)
                
            except KeyboardInterrupt:
                print("\n👋 Goodbye...")
                break
            except Exception as e:
                print(f"❌ Error: {e}")
    
    def generate_report(self, results: Dict, title: str = "Test Report"):
        """Generate test report"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        report_path = self.results_dir / f"test_report_{timestamp}.json"
        
        # Add metadata
        full_report = {
            "title": title,
            "timestamp": timestamp,
            "system_info": {
                "confidence_threshold": self.auth_system.confidence_threshold,
                "registered_users": len(self.auth_system.user_embeddings),
                "classifier_ready": self.auth_system.classifier is not None
            },
            "results": results
        }
        
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(full_report, f, indent=2, ensure_ascii=False)
        
        logger.info(f"📄 Report saved: {report_path}")
        
        # Create visual report
        if results.get("confidences") and MATPLOTLIB_AVAILABLE:
            self._create_visual_report(full_report, timestamp)
        
        return report_path
    
    def _create_visual_report(self, report: Dict, timestamp: str):
        """Create visual report"""
        try:
            results = report["results"]
            
            fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(15, 10))
            
            # Graph 1: Authentication success
            success_data = [results['successful_auths'], results['failed_auths']]
            labels = ['Successful', 'Failed']
            colors = ['#4CAF50', '#F44336']
            
            ax1.pie(success_data, labels=labels, colors=colors, autopct='%1.1f%%', startangle=90)
            ax1.set_title('Authentication Success Rate')
            
            # Graph 2: Confidence distribution
            confidences = results['confidences']
            if confidences:
                ax2.hist(confidences, bins=20, alpha=0.7, color='#2196F3', edgecolor='black')
                ax2.axvline(results['avg_confidence'], color='red', linestyle='--', 
                           label=f'Average: {results["avg_confidence"]:.3f}')
                ax2.axvline(self.auth_system.confidence_threshold, color='orange', linestyle='--',
                           label=f'Threshold: {self.auth_system.confidence_threshold:.3f}')
                ax2.set_xlabel('Confidence')
                ax2.set_ylabel('Frequency')
                ax2.set_title('Confidence Distribution')
                ax2.legend()
            
            # Graph 3: Confidence by test
            if confidences:
                test_numbers = range(1, len(confidences) + 1)
                ax3.plot(test_numbers, confidences, marker='o', markersize=4, alpha=0.7)
                ax3.axhline(self.auth_system.confidence_threshold, color='red', linestyle='--',
                           label=f'Threshold: {self.auth_system.confidence_threshold}')
                ax3.set_xlabel('Test Number')
                ax3.set_ylabel('Confidence')
                ax3.set_title('Confidence by Test')
                ax3.legend()
                ax3.grid(True, alpha=0.3)
            
            # Graph 4: Statistics
            stats_text = f"""
Test: {report['title']}
Time: {report['timestamp']}

Total tests: {results['total_tests']}
Successful: {results['successful_auths']}
Failed: {results['failed_auths']}
Success rate: {results.get('success_rate', 0):.1%}

Confidence:
  Average: {results.get('avg_confidence', 0):.3f}
  Minimum: {results.get('min_confidence', 0):.3f}
  Maximum: {results.get('max_confidence', 0):.3f}
  Threshold: {self.auth_system.confidence_threshold:.3f}

System:
  Registered users: {report['system_info']['registered_users']}
  Classifier ready: {report['system_info']['classifier_ready']}
            """
            ax4.text(0.05, 0.95, stats_text, fontsize=10, verticalalignment='top',
                    transform=ax4.transAxes, fontfamily='monospace')
            ax4.set_xlim(0, 1)
            ax4.set_ylim(0, 1)
            ax4.axis('off')
            ax4.set_title('Statistics')
            
            plt.tight_layout()
            
            # Save graph
            report_img_path = self.results_dir / f"test_report_{timestamp}.png"
            plt.savefig(report_img_path, dpi=300, bbox_inches='tight')
            logger.info(f"📊 Visual report saved: {report_img_path}")
            
            plt.show()
            
        except Exception as e:
            logger.error(f"❌ Error creating visual report: {e}")

def main():
    parser = argparse.ArgumentParser(description="Test script for Face Authentication")
    parser.add_argument("--data-root", "-d", default="data",
                        help="Root data directory (default: data)")
    parser.add_argument("--confidence", "-c", type=float, default=0.75,
                        help="Confidence threshold (default: 0.75)")
    parser.add_argument("--register", "-r", nargs="+",
                        help="Register user(s) (user names)")
    parser.add_argument("--register-all", action="store_true",
                        help="Register all available users")
    parser.add_argument("--test-image", "-t",
                        help="Test single image")
    parser.add_argument("--test-dir", 
                        help="Test all images from directory")
    parser.add_argument("--expected-user", "-u",
                        help="Expected user for test")
    parser.add_argument("--interactive", "-i", action="store_true",
                        help="Interactive test")
    parser.add_argument("--list-users", "-l", action="store_true",
                        help="List available users")
    parser.add_argument("--stats", "-s", action="store_true",
                        help="Show system statistics")
    
    args = parser.parse_args()
    
    print("🚀 Initializing test system...")
    tester = FaceAuthTester(
        data_root=args.data_root,
        confidence_threshold=args.confidence
    )
    
    # List available users
    if args.list_users:
        tester.list_available_users()
        return 0
    
    # Show statistics
    if args.stats:
        stats = tester.auth_system.get_user_stats()
        print(f"\n📊 System statistics:")
        print(f"   👥 Registered users: {stats['total_users']}")
        print(f"   🤖 Classifier trained: {stats['classifier_trained']}")
        if stats['users']:
            print(f"   📋 User list:")
            for user_id, user_info in stats['users'].items():
                print(f"      - {user_id}: {user_info['embeddings_count']} embeddings")
        return 0
    
    # Register users
    if args.register:
        print("🎬 Registering users...")
        tester.register_multiple_users(args.register)
    
    if args.register_all:
        print("🎬 Registering all available users...")
        users = tester.auth_system.list_available_users()
        if users:
            tester.register_multiple_users(users)
        else:
            print("❌ No users found for registration")
            return 1
    
    # Testing
    results = None
    
    if args.test_image:
        print("🧪 Testing single image...")
        result = tester.test_single_image(args.test_image, args.expected_user)
        results = {
            "total_tests": 1,
            "successful_auths": 1 if result["success"] else 0,
            "failed_auths": 0 if result["success"] else 1,
            "confidences": [result["confidence"]] if result["success"] else [],
            "detailed_results": [result]
        }
        
        # Calculate additional statistics
        if results["total_tests"] > 0:
            results["success_rate"] = results["successful_auths"] / results["total_tests"]
            results["avg_confidence"] = np.mean(results["confidences"]) if results["confidences"] else 0
            results["min_confidence"] = min(results["confidences"]) if results["confidences"] else 0
            results["max_confidence"] = max(results["confidences"]) if results["confidences"] else 0
    
    elif args.test_dir:
        print(f"🧪 Testing images from directory: {args.test_dir}")
        results = tester.test_from_directory(args.test_dir, args.expected_user)
    
    # Generate report
    if results:
        print("📊 Generating report...")
        title = f"Test - {args.test_image or args.test_dir or 'Single test'}"
        tester.generate_report(results, title)
    
    # Interactive test
    if args.interactive:
        print("🎮 Interactive test...")
        tester.interactive_test()
    
    # If no action was specified, show help
    if not any([args.register, args.register_all, args.test_image, args.test_dir, 
                args.interactive, args.list_users, args.stats]):
        print("\n💡 Usage examples:")
        print("   # List available users")
        print("   python test_simple_script.py --list-users")
        print()
        print("   # Register user")
        print("   python test_simple_script.py --register user1")
        print()
        print("   # Test image")
        print("   python test_simple_script.py --test-image scripts/data/testimage/image.jpg")
        print()
        print("   # Interactive test")
        print("   python test_simple_script.py --interactive")
        print()
        print("   # Complete workflow")
        print("   python test_simple_script.py --register-all --interactive")
    
    print("✅ Testing completed!")
    return 0

if __name__ == "__main__":
    exit(main())