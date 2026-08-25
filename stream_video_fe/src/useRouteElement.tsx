import { useRoutes } from "react-router-dom"
import Register from "./pages/Register"
import RegisterLayout from "./layouts/RegisterLayout";
import Home from "./pages/Home";

export default function useRouteElement() {
    const routeElements = useRoutes([
        {
            path: '/',
            element: <Home />
        },
        {
            path: '/register',
            element:
                <RegisterLayout>
                    <Register />
                </RegisterLayout>
        }
    ])
    return routeElements;
}
