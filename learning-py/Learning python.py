print("--- Safe Temperature Converter ---")

celsius_input = input("Enter temperature in Celsius: ")

try:
    # Try to convert and calculate
    celsius = float(celsius_input)
    fahrenheit = (celsius * 9/5) + 32
    print(f"{celsius}C is equal to {fahrenheit}F")
    
    if fahrenheit > 80:
        print("It's a hot day! ☀️")
    else:
        print("It's a nice day! ☁️")

except ValueError:
    # This runs ONLY if the user types something that isn't a number
    print("❌ Error: Please enter a valid number (e.g., 25), not words!")

print("The program finished safely.")