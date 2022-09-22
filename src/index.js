import { createRoot } from 'react-dom/client';
import React from 'react'
import styled from './mastro/react'
import { Header } from './header'

import './base.css'

const size = 50;

const PrimaryHeader = styled(Header)`
  font-size: ${size}px;

  &:hover {
    text-decoration: underline;
  }

  &.color-red {
    background-color: red;
  }
  &.color-green {
    background-color: green;
  }
`

console.log('hello')

const root = createRoot(document.getElementById('root'));
root.render(
  <div>
    <PrimaryHeader color="green" title="hello">Hello, world!</PrimaryHeader>
    <Header>Exported header</Header>
  </div>
);
