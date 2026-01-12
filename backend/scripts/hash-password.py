#!/usr/bin/env python3

"""
Password Hashing Utility (Python version)

This script generates a bcrypt hash for a given password.
Use this to hash your admin password before storing it in the .env file.

Usage:
  python3 backend/scripts/hash-password.py <password>
  python3 backend/scripts/hash-password.py  # Interactive mode

Example:
  python3 backend/scripts/hash-password.py mySecurePassword123

The script will output a bcrypt hash that you can copy to your .env file:
  ADMIN_PASSWORD=$2b$10$abc123...xyz789

Requirements:
  - Python 3.6+
  - bcrypt library (pip install bcrypt)
"""

import sys
import getpass

try:
    import bcrypt
except ImportError:
    print("❌ Error: bcrypt library not installed\n")
    print("Install with: pip3 install bcrypt\n")
    print("Or on Alpine/TrueNAS: apk add py3-bcrypt")
    sys.exit(1)


def hash_password(password):
    """Generate bcrypt hash for the given password."""
    # Generate salt and hash with 10 rounds (same as Node.js version)
    salt = bcrypt.gensalt(rounds=10)
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def validate_password_strength(password):
    """Check password strength and return warnings."""
    warnings = []

    if len(password) < 8:
        warnings.append("⚠️  Password is less than 8 characters")
    if len(password) < 12:
        warnings.append("⚠️  Consider using 12+ characters for better security")
    if not any(c.isupper() for c in password):
        warnings.append("⚠️  Consider adding uppercase letters")
    if not any(c.islower() for c in password):
        warnings.append("⚠️  Consider adding lowercase letters")
    if not any(c.isdigit() for c in password):
        warnings.append("⚠️  Consider adding numbers")
    if not any(c in '!@#$%^&*()_+-=[]{}|;:,.<>?' for c in password):
        warnings.append("⚠️  Consider adding special characters")

    return warnings


def main():
    print("🔐 Password Hashing Utility\n")

    # Get password from command line or prompt
    if len(sys.argv) > 1:
        password = sys.argv[1]
        print(f"Using password from command line argument\n")
    else:
        print("No password provided. Enter password interactively:")
        try:
            password = getpass.getpass("Password: ")
            confirm = getpass.getpass("Confirm password: ")

            if password != confirm:
                print("\n❌ Error: Passwords don't match")
                sys.exit(1)
        except KeyboardInterrupt:
            print("\n\n❌ Cancelled")
            sys.exit(1)

    if not password:
        print("❌ Error: Password cannot be empty\n")
        sys.exit(1)

    # Validate password strength
    warnings = validate_password_strength(password)
    if warnings:
        print("\n".join(warnings))
        print()

    # Generate hash
    print("🔐 Generating bcrypt hash...\n")
    try:
        hashed = hash_password(password)
    except Exception as e:
        print(f"❌ Error generating hash: {e}")
        sys.exit(1)

    # Output results
    print("✅ Password hashed successfully!\n")
    print("Copy the following line to your .env file:\n")
    print(f"ADMIN_PASSWORD={hashed}\n")
    print("─" * 60)
    print("Security Notes:")
    print("  • Keep this hash secure - treat it like a password")
    print("  • Never commit your .env file to version control")
    print("  • The hash uses bcrypt with 10 salt rounds")
    print("  • This hash cannot be reversed to get the original password")
    print("─" * 60)


if __name__ == "__main__":
    main()
