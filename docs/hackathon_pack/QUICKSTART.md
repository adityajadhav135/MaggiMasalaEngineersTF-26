# Quick Start — Black Ant Robotics Hackathon

## Recommended setup (Windows)

Install these first:

1. **Python 3.11+** from https://www.python.org/downloads/  
   During installation, tick **Add Python to PATH**.
2. **Visual Studio Code** from https://code.visualstudio.com/
3. **Git** from https://git-scm.com/download/win
4. **Claude Code or another coding agent** you prefer. Follow that provider's current official installation instructions. If using an IDE-based agent, install its official extension or app.

Node.js is only needed if the particular coding agent you choose requires it. Do not install extra tools without checking the chosen agent's requirements.

## Create/open the project

1. Create a folder named `black-ant-simulator`.
2. Copy `AGENTS.md` into that folder.
3. Open the folder in VS Code.
4. Open the integrated terminal.
5. Put `HACKATHON_BUILD_PROMPT.md` somewhere convenient and paste its contents into your coding agent. Tell the agent to work in the currently open folder.

## Python environment

In the VS Code terminal:

```powershell
py -3.11 -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
```

If `py -3.11` is not recognised, install Python 3.11 or newer and use the appropriate installed version. If PowerShell blocks activation, use Command Prompt and run:

```bat
.venv\Scripts\activate.bat
```

The coding agent should create `requirements.txt`. Once it exists, install the project's dependencies:

```powershell
python -m pip install -r requirements.txt
```

If the agent has not created a requirements file yet, a likely initial set is:

```powershell
python -m pip install streamlit numpy scipy plotly pytest
```

Run the app (after `app.py` exists):

```powershell
python -m streamlit run app.py
```

Run tests (after tests exist):

```powershell
python -m pytest -q
```

## What to have ready for the agent

- The original Black Ant Robotics pages from the hackathon PDF.
- The complete rulebook/appendix, if available.
- Any submission instructions, judging rubric, demo time limit and required deliverables.
- Your team’s preferred design concept.
- The time remaining and the machine(s) on which you will demo.

## Two-day operating rule

Get the baseline simulation running first. Then add the Octo-Earth schematic, metrics, validation display and demo polish. Do not let the agent invent a physically impossible force, fake validation results, or label an illustrative simulation as a successful planetary-transfer mechanism.
