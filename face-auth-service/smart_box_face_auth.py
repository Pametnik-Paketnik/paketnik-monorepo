# -*- coding: utf-8 -*-
#!/usr/bin/env python3
"""
Smart Box Face Authentication System - Clean Version
Works directly with already processed images
"""

import cv2
import os
import json
import pickle
import numpy as np
from datetime import datetime
from pathlib import Path
import logging
from typing import List, Tuple, Dict, Optional

# ML/DL imports with error handling
try:
    from keras_vggface.vggface import VGGFace
    from keras_vggface.utils import preprocess_input
    VGGFACE_AVAILABLE = True
except ImportError as e:
    print(f"Warning: keras_vggface not available: {e}")
    print("Install with: pip install keras-vggface")
    VGGFACE_AVAILABLE = False

try:
    from sklearn.svm import SVC
    from sklearn.preprocessing import LabelEncoder
    import joblib
    SKLEARN_AVAILABLE = True
except ImportError as e:
    print(f"Warning: sklearn not available: {e}")
    print("Install with: pip install scikit-learn")
    SKLEARN_AVAILABLE = False

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class SmartBoxFaceAuth:
    def __init__(self, data_root="data", confidence_threshold=0.75):
        """
        Simplified Face Authentication System
        
        Args:
            data_root: Root directory for data
            confidence_threshold: Confidence threshold for authentication
        """
        
        if not VGGFACE_AVAILABLE or not SKLEARN_AVAILABLE:
            raise ImportError("Required packages missing. Install: pip install keras-vggface scikit-learn")
        
        # Setup directory structure
        self.data_root = Path(data_root)
        self.processed_dir = self.data_root / "processed"
        self.models_dir = self.data_root / "models" 
        self.temp_dir = self.data_root / "temp"
        
        # Create directories if they don't exist
        for directory in [self.models_dir, self.temp_dir]:
            directory.mkdir(parents=True, exist_ok=True)
        
        # Parameters
        self.confidence_threshold = confidence_threshold
        self.target_size = (224, 224)
        self.max_embeddings_per_user = 15
        
        # Initialize face detection
        self.face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
        
        # Initialize components
        self.vggface_model = None
        self.classifier = None
        self.label_encoder = None
        self.user_embeddings = {}
        
        # Load models and data
        self._initialize_vggface_model()
        self._load_existing_data()
        
        logger.info("Smart Box Face Authentication System initialized")
        logger.info(f"Data root: {self.data_root}")
        logger.info(f"Processed images: {self.processed_dir}")
        logger.info(f"Models: {self.models_dir}")
    
    def _initialize_vggface_model(self):
        """Initialize VGGFace2 model"""
        try:
            self.vggface_model = VGGFace(
                model='resnet50',
                include_top=False,
                pooling='avg'
            )
            logger.info("VGGFace2 ResNet50 model loaded")
        except Exception as e:
            logger.error(f"Failed to load VGGFace2 model: {e}")
            raise
    
    def _load_existing_data(self):
        """Load existing user data and trained models"""
        try:
            # Load user embeddings
            embeddings_file = self.models_dir / "user_embeddings.pkl"
            if embeddings_file.exists():
                with open(embeddings_file, 'rb') as f:
                    self.user_embeddings = pickle.load(f)
                logger.info(f"Loaded embeddings for {len(self.user_embeddings)} users")
            
            # Load trained classifier
            classifier_file = self.models_dir / "face_classifier.pkl"
            if classifier_file.exists():
                self.classifier = joblib.load(classifier_file)
                logger.info("Loaded trained SVM classifier")
            
            # Load label encoder
            encoder_file = self.models_dir / "label_encoder.pkl"
            if encoder_file.exists():
                self.label_encoder = joblib.load(encoder_file)
                logger.info("Loaded label encoder")
                
        except Exception as e:
            logger.error(f"Error loading existing data: {e}")
    
    def _save_models_and_data(self):
        """Save trained models and user data"""
        try:
            with open(self.models_dir / "user_embeddings.pkl", 'wb') as f:
                pickle.dump(self.user_embeddings, f)
            
            if self.classifier:
                joblib.dump(self.classifier, self.models_dir / "face_classifier.pkl")
            
            if self.label_encoder:
                joblib.dump(self.label_encoder, self.models_dir / "label_encoder.pkl")
                
            logger.info("Models and data saved")
        except Exception as e:
            logger.error(f"Error saving models: {e}")
    
    def list_available_users(self) -> List[str]:
        """List users with processed images available"""
        logger.info(f"Checking for users in: {self.processed_dir}")
        
        if not self.processed_dir.exists():
            logger.error(f"Processed directory does not exist: {self.processed_dir}")
            return []
        
        users = []
        all_dirs = list(self.processed_dir.iterdir())
        logger.info(f"Found {len(all_dirs)} items in processed directory")
        
        for item in all_dirs:
            if item.is_dir():
                image_files = []
                for ext in ['*.jpg', '*.jpeg', '*.png', '*.bmp']:
                    image_files.extend(item.glob(ext))
                    image_files.extend(item.glob(ext.upper()))
                
                logger.info(f"   {item.name}: {len(image_files)} images")
                
                if image_files:
                    users.append(item.name)
                    example_images = [img.name for img in image_files[:3]]
                    logger.info(f"      Examples: {', '.join(example_images)}")
                    if len(image_files) > 3:
                        logger.info(f"      ... and {len(image_files) - 3} more")
            else:
                logger.info(f"   {item.name} (file - skipping)")
        
        if users:
            logger.info(f"Found {len(users)} users with processed images: {users}")
        else:
            logger.warning("No users found with processed images")
        
        return users
    
    def load_processed_images_for_user(self, user_id: str) -> List[np.ndarray]:
        """Load processed images for a user"""
        user_processed_dir = self.processed_dir / user_id
        
        if not user_processed_dir.exists():
            logger.error(f"Processed directory not found for user: {user_id}")
            return []
        
        image_extensions = ['*.jpg', '*.jpeg', '*.png', '*.bmp']
        image_files = []
        for ext in image_extensions:
            image_files.extend(user_processed_dir.glob(ext))
            image_files.extend(user_processed_dir.glob(ext.upper()))
        
        if not image_files:
            logger.error(f"No processed images found for user: {user_id}")
            return []
        
        logger.info(f"Found {len(image_files)} processed images for user: {user_id}")
        
        images = []
        for img_path in image_files:
            try:
                img = cv2.imread(str(img_path))
                if img is not None:
                    images.append(img)
            except Exception as e:
                logger.warning(f"Failed to load image {img_path}: {e}")
        
        logger.info(f"Successfully loaded {len(images)} images for user: {user_id}")
        return images
    
    def _detect_and_crop_face(self, image: np.ndarray) -> np.ndarray:
        """Simple face detection and cropping"""
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
        
        faces = self.face_cascade.detectMultiScale(gray, 1.1, 4, minSize=(50, 50))
        
        if len(faces) > 0:
            largest_face = max(faces, key=lambda face: face[2] * face[3])
            x, y, w, h = largest_face
            
            padding = int(min(w, h) * 0.2)
            x1 = max(0, x - padding)
            y1 = max(0, y - padding)
            x2 = min(image.shape[1], x + w + padding)
            y2 = min(image.shape[0], y + h + padding)
            
            return image[y1:y2, x1:x2]
        
        # If no face detected, return center crop
        h, w = image.shape[:2]
        size = min(h, w)
        start_x = (w - size) // 2
        start_y = (h - size) // 2
        return image[start_y:start_y+size, start_x:start_x+size]
    
    def _extract_single_embedding(self, image: np.ndarray) -> Optional[np.ndarray]:
        """Extract VGGFace2 embedding from image"""
        try:
            face_cropped = self._detect_and_crop_face(image)
            face_resized = cv2.resize(face_cropped, self.target_size)
            face_rgb = cv2.cvtColor(face_resized, cv2.COLOR_BGR2RGB)
            
            face_array = np.expand_dims(face_rgb, axis=0)
            face_preprocessed = preprocess_input(face_array, version=2)
            
            embedding = self.vggface_model.predict(face_preprocessed, verbose=0)
            return embedding.flatten()
            
        except Exception as e:
            logger.debug(f"Error extracting embedding: {e}")
            return None
    
    def _score_face_images(self, images: List[np.ndarray]) -> List[Tuple[np.ndarray, float]]:
        """Score face images by quality"""
        scored_images = []
        
        for i, img in enumerate(images):
            try:
                if img.shape[0] < 100 or img.shape[1] < 100:
                    continue
                
                if len(img.shape) == 3:
                    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                else:
                    gray = img
                
                # Calculate quality metrics
                sharpness = cv2.Laplacian(gray, cv2.CV_64F).var()
                brightness = np.mean(gray)
                brightness_score = 1.0 - abs(brightness - 128) / 128
                
                faces = self.face_cascade.detectMultiScale(gray, 1.1, 4, minSize=(50, 50))
                face_score = 1.0 if len(faces) > 0 else 0.5
                
                quality_score = (
                    0.4 * min(sharpness / 500, 1.0) +
                    0.3 * brightness_score +
                    0.3 * face_score
                )
                
                scored_images.append((img, quality_score))
                
            except Exception as e:
                logger.debug(f"Error scoring image {i}: {e}")
                continue
        
        scored_images.sort(key=lambda x: x[1], reverse=True)
        return scored_images
    
    def register_user_from_processed_images(self, user_id: str) -> Dict:
        """Register user from processed images"""
        logger.info(f"Registering user from processed images: {user_id}")
        
        try:
            processed_images = self.load_processed_images_for_user(user_id)
            if not processed_images:
                return {"success": False, "error": "No processed images found"}
            
            scored_images = self._score_face_images(processed_images)
            if not scored_images:
                return {"success": False, "error": "No valid images for embedding extraction"}
            
            best_images = scored_images[:self.max_embeddings_per_user]
            logger.info(f"Selected {len(best_images)} best images for embeddings")
            
            embeddings = []
            for img, score in best_images:
                try:
                    embedding = self._extract_single_embedding(img)
                    if embedding is not None:
                        embeddings.append(embedding)
                except Exception as e:
                    logger.debug(f"Failed to extract embedding: {e}")
                    continue
            
            if not embeddings:
                return {"success": False, "error": "Failed to extract face embeddings"}
            
            self.user_embeddings[user_id] = {
                'embeddings': embeddings,
                'registration_date': datetime.now().isoformat(),
                'num_images': len(processed_images),
                'num_embeddings': len(embeddings)
            }
            
            logger.info(f"Stored {len(embeddings)} embeddings for user: {user_id}")
            
            training_success = self._retrain_classifier()
            self._save_models_and_data()
            
            result = {
                "success": True,
                "user_id": user_id,
                "images_processed": len(processed_images),
                "embeddings_extracted": len(embeddings),
                "classifier_trained": training_success,
                "registration_date": self.user_embeddings[user_id]['registration_date']
            }
            
            logger.info(f"Registration completed for user {user_id}")
            return result
            
        except Exception as e:
            logger.error(f"Registration failed for user {user_id}: {e}")
            return {"success": False, "error": str(e)}
    
    def _retrain_classifier(self) -> bool:
        """Retrain SVM classifier"""
        try:
            if len(self.user_embeddings) < 2:
                logger.info("Need at least 2 users to train classifier")
                return False
            
            X, y = [], []
            
            for user_id, user_data in self.user_embeddings.items():
                for embedding in user_data['embeddings']:
                    X.append(embedding)
                    y.append(user_id)
            
            X = np.array(X)
            y = np.array(y)
            
            logger.info(f"Training classifier with {len(X)} samples from {len(self.user_embeddings)} users")
            
            if self.label_encoder is None:
                self.label_encoder = LabelEncoder()
            
            all_user_ids = list(self.user_embeddings.keys())
            self.label_encoder.fit(all_user_ids)
            y_encoded = self.label_encoder.transform(y)
            
            self.classifier = SVC(
                kernel='rbf',
                probability=True,
                C=1.0,
                gamma='scale',
                random_state=42
            )
            
            self.classifier.fit(X, y_encoded)
            
            train_accuracy = self.classifier.score(X, y_encoded)
            logger.info(f"Classifier training accuracy: {train_accuracy:.3f}")
            
            return True
            
        except Exception as e:
            logger.error(f"Classifier training failed: {e}")
            return False
    
    def authenticate_user(self, image_data, method='image') -> Dict:
        """Authenticate user"""
        logger.info("Starting user authentication")
        
        try:
            if self.classifier is None or self.label_encoder is None:
                return {
                    "success": False,
                    "error": "System not trained - no users registered",
                    "user_id": None,
                    "confidence": 0.0
                }
            
            if method == 'image':
                frame = cv2.imread(str(image_data))
            elif method == 'array':
                frame = image_data
            elif method == 'base64':
                import base64
                img_data = base64.b64decode(image_data)
                nparr = np.frombuffer(img_data, np.uint8)
                frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            if frame is None:
                return {
                    "success": False,
                    "error": "Failed to load image",
                    "user_id": None,
                    "confidence": 0.0
                }
            
            embedding = self._extract_single_embedding(frame)
            if embedding is None:
                return {
                    "success": False,
                    "error": "No face detected in image",
                    "user_id": None,
                    "confidence": 0.0
                }
            
            embedding_reshaped = embedding.reshape(1, -1)
            
            probabilities = self.classifier.predict_proba(embedding_reshaped)[0]
            predicted_class = np.argmax(probabilities)
            confidence = probabilities[predicted_class]
            
            predicted_user_id = self.label_encoder.inverse_transform([predicted_class])[0]
            
            success = confidence >= self.confidence_threshold
            
            result = {
                "success": success,
                "user_id": predicted_user_id if success else None,
                "confidence": float(confidence),
                "threshold": self.confidence_threshold,
                "authentication_time": datetime.now().isoformat()
            }
            
            if success:
                logger.info(f"Authentication successful: {predicted_user_id} (confidence: {confidence:.3f})")
            else:
                logger.info(f"Authentication failed: {predicted_user_id} (confidence: {confidence:.3f} < {self.confidence_threshold})")
            
            return result
            
        except Exception as e:
            logger.error(f"Authentication error: {e}")
            return {
                "success": False,
                "error": str(e),
                "user_id": None,
                "confidence": 0.0
            }
    
    def get_user_stats(self) -> Dict:
        """Get system statistics"""
        stats = {
            "total_users": len(self.user_embeddings),
            "classifier_trained": self.classifier is not None,
            "users": {}
        }
        
        for user_id, user_data in self.user_embeddings.items():
            stats["users"][user_id] = {
                "embeddings_count": len(user_data['embeddings']),
                "registration_date": user_data['registration_date']
            }
        
        return stats
    
    def remove_user(self, user_id: str) -> bool:
        """Remove a user"""
        try:
            if user_id not in self.user_embeddings:
                logger.warning(f"User {user_id} not found")
                return False
            
            del self.user_embeddings[user_id]
            
            if len(self.user_embeddings) >= 2:
                self._retrain_classifier()
            else:
                self.classifier = None
                self.label_encoder = None
            
            self._save_models_and_data()
            
            logger.info(f"User {user_id} removed successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error removing user {user_id}: {e}")
            return False

if __name__ == "__main__":
    auth_system = SmartBoxFaceAuth(data_root="data", confidence_threshold=0.75)
    users = auth_system.list_available_users()
    print(f"Available users: {users}")