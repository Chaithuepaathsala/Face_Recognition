from pymongo import MongoClient
import os
from dotenv import load_dotenv


#client = MongoClient("mongodb://localhost:27017/")
#db = client["faceauthorization"]
#users_collection = db["students"]


load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME")

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
users_collection = db["students"]

