# app.py
from converters import celsius_to_fahrenheit

print("--- Professional Multi-File App ---")

user_input = input("Enter Celsius: ")

try:
    c = float(user_input)
    # We call the function from the other file!
    f = celsius_to_fahrenheit(c)
    print(f"Result: {f}F")
except ValueError:
    print("Invalid input.")