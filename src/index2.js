import ReactDOM from 'react-dom'
import styled from 'astroturf/react'
import { Badge } from '@calendly/ui/components/badge'
import { Header } from './header'
import {
  primaryColor,
} from '@calendly/ui/theme'
import { Icon } from '@calendly/ui/components/icon'
import { Span } from './span'
import { IndexExport } from './index_export'

const PrimaryHeader = styled(Header).attrs((props) => ({
  ...props,
  disabledState: props.disabled,
}))`
  color: ${primaryColor};

  &.disabledState {
    opacity: 0.5
  }

  ${Icon} {
    letter-spacing: 10px;
  }
`

//   ${Icon} {
//     letter-spacing: 10px;
//   }
// `

//   ${IndexExport} {
//     font-size: 30px;
//   }
// `

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<PrimaryHeader disabled>Hello, world! <Span>span</Span> <IndexExport /> <Badge type="success">New</Badge></PrimaryHeader>);
