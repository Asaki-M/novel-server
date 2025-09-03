import antfu from '@antfu/eslint-config'

export default antfu({
  stylistic: {
    indent: 2,
  },
  rules: {
    'dot-notation': 'off',
    'new-cap': 'off',
    'no-console': 'off',
  },
})
