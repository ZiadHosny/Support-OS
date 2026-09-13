Password (all accounts)

Passw0rd!2026
Staff / agents
Email Role
admin@supportos.local Super Admin
manager.sara@supportos.local Manager
agent.omar@supportos.local Agent
agent.lina@supportos.local Agent
agent.hassan.inactive@supportos.local Agent (inactive account, for testing)
agent.mfa@supportos.local Agent (has MFA/2FA enabled)
For agent.mfa@supportos.local, login also needs a TOTP code — the seed script prints agent_mfa_totp_secret_base32 and agent_mfa_recovery_codes at the end of the run, so check that command's console output.

Customers (portal login)
Email Name
nadia.fathy@example.com Nadia Fathy
youssef.adel@example.com Youssef Adel
accounts@khalidtrading.example.com Khalid Trading
mariam.elsayed@example.com Mariam Elsayed
procurement@globalmart.example.com GlobalMart
layla.new@example.com Layla Hamdy
Note: this only exists if you've run python manage.py seed_demo_data locally — it's fake data for dev/testing, not anything pulled from a real database (real passwords are hashed and never retrievable). Full details are also documented in HOW_TO_USE.md.
