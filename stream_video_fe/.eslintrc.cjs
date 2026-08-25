const path = require('path')
module.exports = {
    "root": true,
    "parser": "@typescript-eslint/parser",
    "parserOptions": {
        "ecmaVersion": "latest",
        "sourceType": "module",
        "ecmaFeatures": {
            "jsx": true
        }
    },
    "settings": {
        "react": {
            "version": "detect"
        },
        "import/resolver": {
            "node": {
                "paths": [
                    path.resolve(__dirname)
                ],
                "extensions": [
                    ".js",
                    ".jsx",
                    ".ts",
                    ".tsx"
                ]
            }
        }
    },
    "env": {
        "browser": true,
        "es2021": true,
        "node": true
    },
    "plugins": [
        "react",
        "@typescript-eslint",
        "import",
        "jsx-a11y",
        "prettier"
    ],
    "extends": [
        "eslint:recommended",
        "plugin:react/recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:jsx-a11y/recommended",
        "plugin:import/errors",
        "plugin:import/warnings",
        "plugin:import/typescript",
        "plugin:prettier/recommended",
        "eslint-config-prettier",
        "prettier"
    ],
    "rules": {
        "prettier/prettier": [
            "error"
        ],
        "react/react-in-jsx-scope": "off",
        "@typescript-eslint/no-unused-vars": [
            "warn"
        ],
        "import/order": [
            "warn",
            {
                "groups": [
                    "builtin",
                    "external",
                    "internal",
                    "parent",
                    "sibling",
                    "index"
                ],
                "alphabetize": {
                    "order": "asc",
                    "caseInsensitive": true
                },
                "newlines-between": "always"
            }
        ]
    }
}