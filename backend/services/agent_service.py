import random
from models.agent import Agent

def pick_random_agent():
    agents = Agent.query.all()
    return random.choice(agents) if agents else None