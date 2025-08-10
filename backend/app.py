import sqlite3
from flask import Flask, g

app = Flask(__name__)

DATABASE = './test.db'

def get_db():
    db = getattr(g, '__database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
    return db

@app.teardown_appcontex
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

