import invariant from 'invariant'
import React from 'react'
import { isValidElementType } from 'react-is'
import { array, func, object } from 'prop-types'
import getRouteParams from './getRouteParams'
import { isReactChildren } from './RouteUtils'

/**
 * A <RouterContext> renders the component tree for a given router state
 * and sets the history object and the current location in context.
 */

function makeContextName(name) {
  return `@@contextSubscriber/${name}`
}

const contextName = makeContextName('router')
const listenersKey = `${contextName}/listeners`
const eventIndexKey = `${contextName}/eventIndex`
const subscribeKey = `${contextName}/subscribe`

export const Ctx = React.createContext(contextName)

class RouterContext extends React.Component {
  createElement(component, props) {
    return component == null ? null : this.props.createElement(component, props)
  }

  UNSAFE_componentWillMount() {
    this[listenersKey] = []
    this[eventIndexKey] = 0
  }

  // this method will be updated to UNSAFE_componentWillReceiveProps below for React versions >= 16.3
  UNSAFE_componentWillReceiveProps() {
    this[eventIndexKey]++
  }

  componentDidUpdate() {
    this[listenersKey].forEach(listener =>
      listener(this[eventIndexKey])
    )
  }

  [subscribeKey](listener) {
    // No need to immediately call listener here.
    this[listenersKey].push(listener)

    return () => {
      this[listenersKey] = this[listenersKey].filter(item =>
        item !== listener
      )
    }
  }

  render() {
    const { location, routes, params, components, router } = this.props
    let element = null

    if (components) {
      element = components.reduceRight((element, components, index) => {
        if (components == null)
          return element // Don't create new children; use the grandchildren.

        const route = routes[index]
        const routeParams = getRouteParams(route, params)
        const props = {
          location,
          params,
          route,
          router,
          routeParams,
          routes
        }

        if (isReactChildren(element)) {
          props.children = element
        } else if (element) {
          for (const prop in element)
            if (Object.prototype.hasOwnProperty.call(element, prop))
              props[prop] = element[prop]
        }

        // Handle components is object for { [name]: component } but not valid element
        // type of react, such as React.memo, React.lazy and so on.
        if (typeof components === 'object' && !isValidElementType(components)) {
          const elements = {}

          for (const key in components) {
            if (Object.prototype.hasOwnProperty.call(components, key)) {
              // Pass through the key as a prop to createElement to allow
              // custom createElement functions to know which named component
              // they're rendering, for e.g. matching up to fetched data.
              elements[key] = this.createElement(components[key], {
                key, ...props
              })
            }
          }

          return elements
        }

        return (
          <Ctx.Provider value={{ ...props }}>
            {this.createElement(components, props)}
          </Ctx.Provider>
        )
      }, element)
    }

    invariant(
      element === null || element === false || React.isValidElement(element),
      'The root route must render a single element'
    )

    return (
      <Ctx.Provider value={{ ...this.props }}>
        {element}
      </Ctx.Provider>
    )
  }
}

RouterContext.propTypes = {
  router: object.isRequired,
  location: object.isRequired,
  routes: array.isRequired,
  params: object.isRequired,
  components: array.isRequired,
  createElement: func.isRequired
}

RouterContext.defaultProps = {
  createElement: React.createElement
}

export default RouterContext
